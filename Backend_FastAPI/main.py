import os
import uuid
import shutil
import io
import zipfile
from datetime import datetime, timezone
from typing import Optional, List, Literal
from fastapi import FastAPI, Header, HTTPException, Query, Depends, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, computed_field
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
import httpx

from auth import get_current_user_id, get_firebase_auth_diagnostics
from services.gemini_service import gemini_service
from services.negotiation_logic import (
    TONES_FOLLOWUP,
    TONES_NEGOTIATION,
    annual_total_comp,
    tone_or_default,
)

DATA_DIR = os.environ.get("DATA_DIR", "./data")
os.makedirs(DATA_DIR, exist_ok=True)

SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{os.path.join(DATA_DIR, 'jobtracker.db')}")
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


def validate_document_content(content: bytes, content_type: str) -> bool:
    if content_type == "application/pdf":
        return content.startswith(b"%PDF-")
    if content_type == "application/msword":
        return content.startswith(bytes.fromhex("D0CF11E0A1B11AE1"))
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = set(archive.namelist())
                return "[Content_Types].xml" in names and "word/document.xml" in names
        except (zipfile.BadZipFile, OSError):
            return False
    return False

# ---------------------------------------------------------
# SQLAlchemy Models
# ---------------------------------------------------------

class ApplicationDB(Base):
    __tablename__ = "applications"
    id = Column(String, primary_key=True, index=True)
    userId = Column(String, index=True)
    company = Column(String)
    jobTitle = Column(String)
    applicationSource = Column(String)
    status = Column(String)
    applicationUrl = Column(String, nullable=True)
    jobDescription = Column(Text, nullable=True)
    salaryRange = Column(String, nullable=True)
    location = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    followUpDate = Column(String, nullable=True)
    matchScore = Column(Float, nullable=True)
    createdAt = Column(String)
    updatedAt = Column(String)
    
    documents = relationship("DocumentDB", back_populates="application", cascade="all, delete-orphan")
    reminders = relationship("ReminderDB", back_populates="application", cascade="all, delete-orphan")
    followUpLogs = relationship("FollowUpLogDB", back_populates="application", cascade="all, delete-orphan")

class DocumentDB(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True, index=True)
    userId = Column(String, index=True)
    applicationId = Column(String, ForeignKey("applications.id", ondelete="CASCADE"), nullable=True)
    fileName = Column(String)
    fileType = Column(String)
    fileSize = Column(Integer)
    storageRef = Column(String)
    displayName = Column(String, nullable=True)
    createdAt = Column(String)
    
    application = relationship("ApplicationDB", back_populates="documents")

class ReminderDB(Base):
    __tablename__ = "reminders"
    id = Column(String, primary_key=True, index=True)
    userId = Column(String, index=True)
    applicationId = Column(String, ForeignKey("applications.id", ondelete="CASCADE"))
    reminderDate = Column(String)
    type = Column(String)
    message = Column(Text, nullable=True)
    isCompleted = Column(Boolean, default=False)
    createdAt = Column(String)
    
    application = relationship("ApplicationDB", back_populates="reminders")

class OfferDB(Base):
    __tablename__ = "offers"
    id = Column(String, primary_key=True, index=True)
    userId = Column(String, index=True)
    # Optional link to the tracked application; kept (set to NULL) if the application is deleted.
    applicationId = Column(String, nullable=True, index=True)
    company = Column(String)
    jobTitle = Column(String)
    location = Column(String, nullable=True)
    workMode = Column(String, default="Hybrid")
    currency = Column(String, default="USD")
    baseSalary = Column(Float, default=0)
    annualBonus = Column(Float, default=0)
    signingBonus = Column(Float, default=0)
    equityValue = Column(Float, default=0)
    equityVestYears = Column(Float, default=4)
    retirementMatchPct = Column(Float, default=0)
    otherBenefitsValue = Column(Float, default=0)
    ptoDays = Column(Integer, nullable=True)
    growthRating = Column(Integer, default=3)
    workLifeRating = Column(Integer, default=3)
    cultureRating = Column(Integer, default=3)
    deadline = Column(String, nullable=True)
    status = Column(String, default="Pending")
    notes = Column(Text, nullable=True)
    negotiationPlan = Column(Text, nullable=True)  # JSON string of the last generated plan
    createdAt = Column(String)
    updatedAt = Column(String)

class FollowUpSettingsDB(Base):
    __tablename__ = "followup_settings"
    userId = Column(String, primary_key=True, index=True)
    enabled = Column(Boolean, default=True)
    appliedDays = Column(Integer, default=7)
    underReviewDays = Column(Integer, default=10)
    interviewDays = Column(Integer, default=4)
    maxFollowUps = Column(Integer, default=3)
    autoCreateReminders = Column(Boolean, default=True)
    defaultTone = Column(String, default="polite")
    updatedAt = Column(String)

class FollowUpLogDB(Base):
    __tablename__ = "followup_logs"
    id = Column(String, primary_key=True, index=True)
    userId = Column(String, index=True)
    applicationId = Column(String, ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    channel = Column(String, default="email")
    tone = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    createdAt = Column(String)

    application = relationship("ApplicationDB", back_populates="followUpLogs")

# Create the database tables
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------
# FastAPI Setup
# ---------------------------------------------------------

app = FastAPI(title="JobTracker FastAPI")

CONFIGURED_CORS_ORIGINS = {
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173").split(",")
    if origin.strip()
}
PRODUCTION_FRONTEND_ORIGIN = "https://job-application-tracker-pearl-nine.vercel.app"
CORS_ORIGINS = sorted(CONFIGURED_CORS_ORIGINS | {PRODUCTION_FRONTEND_ORIGIN})

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------

class ApplicationBase(BaseModel):
    company: str
    jobTitle: str
    applicationSource: str
    status: str
    applicationUrl: Optional[str] = None
    jobDescription: Optional[str] = None
    salaryRange: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    followUpDate: Optional[str] = None
    matchScore: Optional[float] = None

class ApplicationCreate(ApplicationBase):
    pass

class ApplicationUpdate(BaseModel):
    company: Optional[str] = None
    jobTitle: Optional[str] = None
    applicationSource: Optional[str] = None
    status: Optional[str] = None
    applicationUrl: Optional[str] = None
    jobDescription: Optional[str] = None
    salaryRange: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    followUpDate: Optional[str] = None
    matchScore: Optional[float] = None

class ApplicationOut(ApplicationBase):
    id: str
    userId: str
    matchScore: Optional[float] = None
    createdAt: str
    updatedAt: str
    class Config:
        from_attributes = True

class DocumentOut(BaseModel):
    id: str
    userId: str
    fileName: str
    fileType: str
    fileSize: int
    storageRef: str
    applicationId: Optional[str] = None
    displayName: Optional[str] = None
    createdAt: str
    class Config:
        from_attributes = True

class ReminderBase(BaseModel):
    applicationId: str
    reminderDate: str
    type: str
    message: Optional[str] = None

class ReminderCreate(ReminderBase):
    pass

class ReminderUpdate(BaseModel):
    reminderDate: Optional[str] = None
    type: Optional[str] = None
    message: Optional[str] = None
    isCompleted: Optional[bool] = None

class ReminderOut(ReminderBase):
    id: str
    userId: str
    isCompleted: bool
    createdAt: str
    class Config:
        from_attributes = True

class DashboardStatsByStatus(BaseModel):
    saved: int
    applied: int
    underReview: int
    interview: int
    offer: int
    rejected: int

class DashboardStatsOut(BaseModel):
    totalApplications: int
    byStatus: DashboardStatsByStatus
    recentApplications: List[ApplicationOut]
    upcomingFollowUps: List[ApplicationOut]

# ---------------------------------------------------------
# Health Check Endpoint
# ---------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok", "message": "JobPilot API is running successfully!"}

@app.get("/api/health")
def health_check():
    return {"status": "ok", **get_firebase_auth_diagnostics()}

ALLOWED_GEMINI_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-pro",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "liquid/lfm-2.5-embedding-350m:free",
}

class AIChatRequest(BaseModel):
    messages: List[dict]
    max_tokens: int = 700

class AIResumeParseRequest(BaseModel):
    resumeText: str = Field(..., min_length=1, max_length=200000)

class AICoverLetterRequest(BaseModel):
    applicantName: str = ""
    company: str = Field(..., min_length=1, max_length=200)
    jobTitle: str = Field(..., min_length=1, max_length=200)
    jobDescription: Optional[str] = Field(default=None, max_length=20000)
    resumeHighlights: Optional[str] = Field(default=None, max_length=20000)

class AIInterviewRequest(BaseModel):
    role: str = Field(..., min_length=1, max_length=300)
    context: str = Field(..., min_length=1, max_length=20000)

class AIMatchRequest(BaseModel):
    resumeText: str = Field(..., min_length=1, max_length=200000)
    jobText: str = Field(..., min_length=1, max_length=200000)


@app.post("/api/ai/chat")
async def ai_chat(request: AIChatRequest, user_id: str = Depends(get_current_user_id)):
    if not isinstance(request.messages, list) or not 1 <= len(request.messages) <= 20:
        raise HTTPException(status_code=422, detail="Invalid AI conversation")
    if any(not isinstance(message, dict) or not isinstance(message.get("content"), str) or len(message["content"]) > 12000 for message in request.messages):
        raise HTTPException(status_code=422, detail="AI message is invalid or too large")
    if not 1 <= request.max_tokens <= 2000:
        raise HTTPException(status_code=422, detail="AI token limit is invalid")
    if not gemini_service.is_configured():
        raise HTTPException(status_code=503, detail="Gemini AI service unavailable")
    return {"content": await gemini_service.chat(request.messages, request.max_tokens)}


@app.post("/api/ai/chat/completions")
async def legacy_ai_chat_completions(payload: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    model = payload.get("model")
    if model is not None and str(model) not in ALLOWED_GEMINI_MODELS:
        raise HTTPException(status_code=422, detail="AI model is not allowed")
    if not gemini_service.is_configured():
        raise HTTPException(status_code=503, detail="AI service is not configured")
    messages = payload.get("messages")
    if not isinstance(messages, list) or not 1 <= len(messages) <= 20:
        raise HTTPException(status_code=422, detail="Invalid AI conversation")
    if any(not isinstance(message, dict) or not isinstance(message.get("content"), str) or len(message["content"]) > 12000 for message in messages):
        raise HTTPException(status_code=422, detail="AI message is invalid or too large")
    max_tokens = payload.get("max_tokens", 700)
    if not isinstance(max_tokens, int) or not 1 <= max_tokens <= 2000:
        raise HTTPException(status_code=422, detail="AI token limit is invalid")
    content = await gemini_service.chat(messages, max_tokens)
    return {"choices": [{"message": {"content": content}}]}


@app.post("/api/ai/embeddings")
async def legacy_ai_embeddings(payload: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    model = payload.get("model")
    if model is not None and str(model) not in ALLOWED_GEMINI_MODELS and str(model) != "gemini-embedding-001":
        raise HTTPException(status_code=422, detail="AI model is not allowed")
    if not gemini_service.is_configured():
        raise HTTPException(status_code=503, detail="AI service is not configured")
    input_value = payload.get("input")
    texts = input_value if isinstance(input_value, list) else [input_value]
    if not texts or len(texts) > 8 or any(not isinstance(text, str) or len(text) > 12000 for text in texts):
        raise HTTPException(status_code=422, detail="AI embedding input is invalid or too large")
    embeddings = await gemini_service.embed(texts)
    return {"data": [{"embedding": embedding} for embedding in embeddings]}


@app.post("/api/ai/resume-parse")
async def ai_resume_parse(request: AIResumeParseRequest, user_id: str = Depends(get_current_user_id)):
    if not gemini_service.is_configured():
        raise HTTPException(status_code=503, detail="Gemini AI service unavailable")
    return await gemini_service.parse_resume(request.resumeText)


@app.post("/api/ai/cover-letter")
async def ai_cover_letter(request: AICoverLetterRequest, user_id: str = Depends(get_current_user_id)):
    if not gemini_service.is_configured():
        raise HTTPException(status_code=503, detail="Gemini AI service unavailable")
    content = await gemini_service.generate_cover_letter(
        request.applicantName,
        request.company,
        request.jobTitle,
        request.jobDescription,
        request.resumeHighlights,
    )
    return {"content": content}


@app.post("/api/ai/interview")
async def ai_interview(request: AIInterviewRequest, user_id: str = Depends(get_current_user_id)):
    if not gemini_service.is_configured():
        raise HTTPException(status_code=503, detail="Gemini AI service unavailable")
    return {"content": await gemini_service.generate_interview_questions(request.role, request.context)}


@app.post("/api/ai/match")
async def ai_match(request: AIMatchRequest, user_id: str = Depends(get_current_user_id)):
    if not gemini_service.is_configured():
        raise HTTPException(status_code=503, detail="Gemini AI service unavailable")
    score = await gemini_service.match_score(request.resumeText, request.jobText)
    return {"score": score}

# ---------------------------------------------------------
# Application Endpoints
# ---------------------------------------------------------

@app.get("/api/applications", response_model=List[ApplicationOut])
def get_applications(
    status: Optional[str] = None,
    applicationSource: Optional[str] = None,
    search: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    query = db.query(ApplicationDB).filter(ApplicationDB.userId == user_id)
    if status and status != "All":
        query = query.filter(ApplicationDB.status == status)
    if applicationSource and applicationSource != "All":
        query = query.filter(ApplicationDB.applicationSource == applicationSource)
    
    apps = query.all()
    if search:
        search_lower = search.lower()
        apps = [a for a in apps if (a.company and search_lower in a.company.lower()) or (a.jobTitle and search_lower in a.jobTitle.lower())]
        
    apps.sort(key=lambda x: x.createdAt, reverse=True)
    return apps

@app.get("/api/applications/{app_id}", response_model=ApplicationOut)
def get_application(app_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    app_doc = db.query(ApplicationDB).filter(ApplicationDB.id == app_id, ApplicationDB.userId == user_id).first()
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    return app_doc

@app.post("/api/applications", response_model=ApplicationOut, status_code=201)
def create_application(app_in: ApplicationCreate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    existing_apps = db.query(ApplicationDB).filter(ApplicationDB.userId == user_id).all()
    normalized_company = app_in.company.strip().casefold()
    normalized_title = app_in.jobTitle.strip().casefold()
    for existing in existing_apps:
        if (
            existing.company.strip().casefold() == normalized_company
            and existing.jobTitle.strip().casefold() == normalized_title
        ):
            if existing.status == "Saved" and app_in.status == "Applied":
                existing.status = "Applied"
                existing.updatedAt = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                db.commit()
                db.refresh(existing)
            return existing

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    new_app = ApplicationDB(
        id=f"app-{uuid.uuid4().hex[:10]}",
        userId=user_id,
        createdAt=now,
        updatedAt=now,
        **app_in.model_dump(exclude_none=True)
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

@app.patch("/api/applications/{app_id}", response_model=ApplicationOut)
def update_application(app_id: str, app_in: ApplicationUpdate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    app_doc = db.query(ApplicationDB).filter(ApplicationDB.id == app_id, ApplicationDB.userId == user_id).first()
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    
    update_data = app_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(app_doc, key, value)
    
    app_doc.updatedAt = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    db.commit()
    db.refresh(app_doc)
    return app_doc

@app.delete("/api/applications/{app_id}", status_code=204)
def delete_application(app_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    app_doc = db.query(ApplicationDB).filter(ApplicationDB.id == app_id, ApplicationDB.userId == user_id).first()
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Cascade delete physical files
    for doc in app_doc.documents:
        if os.path.exists(doc.storageRef):
            try:
                os.remove(doc.storageRef)
            except Exception:
                pass

    # Offers outlive the tracker entry: just detach them.
    db.query(OfferDB).filter(OfferDB.userId == user_id, OfferDB.applicationId == app_id).update(
        {"applicationId": None}
    )
    db.delete(app_doc)
    db.commit()
    return None

# ---------------------------------------------------------
# Document Endpoints
# ---------------------------------------------------------

@app.get("/api/documents", response_model=List[DocumentOut])
def get_documents(applicationId: Optional[str] = None, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    query = db.query(DocumentDB).filter(DocumentDB.userId == user_id)
    if applicationId:
        query = query.filter(DocumentDB.applicationId == applicationId)
    return query.order_by(DocumentDB.createdAt.desc()).all()

@app.post("/api/documents/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    applicationId: Optional[str] = Form(None),
    displayName: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    extension = ALLOWED_MIME_TYPES.get(file.content_type or "")
    if not extension:
        raise HTTPException(status_code=422, detail="Unsupported file type")

    content = await file.read(MAX_FILE_SIZE + 1)
    file_size = len(content)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")
    if not validate_document_content(content, file.content_type or ""):
        raise HTTPException(status_code=422, detail="File content does not match the selected document type")

    if applicationId:
        app_doc = db.query(ApplicationDB).filter(ApplicationDB.id == applicationId, ApplicationDB.userId == user_id).first()
        if not app_doc:
            raise HTTPException(status_code=404, detail="Application not found or access denied")
    
    file_id = uuid.uuid4().hex
    original_name = os.path.basename(file.filename or "")
    safe_filename = "".join(c for c in original_name if c.isalnum() or c in " ._-").strip(" .")
    if not safe_filename:
        safe_filename = "document" + extension
        
    storage_path = os.path.join(UPLOAD_DIR, f"{file_id}_{safe_filename}")
    
    try:
        with open(storage_path, "wb") as buffer:
            buffer.write(content)
    except OSError:
        if os.path.exists(storage_path):
            os.remove(storage_path)
        raise HTTPException(status_code=500, detail="Failed to save file")
    
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    new_doc = DocumentDB(
        id=f"doc-{file_id[:10]}",
        userId=user_id,
        applicationId=applicationId,
        fileName=file.filename or safe_filename,
        fileType=file.content_type,
        fileSize=file_size,
        storageRef=storage_path,
        displayName=displayName,
        createdAt=now
    )
    try:
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
    except Exception:
        db.rollback()
        if os.path.exists(storage_path):
            os.remove(storage_path)
        raise HTTPException(status_code=500, detail="Failed to record uploaded document")
    return new_doc

@app.get("/api/documents/{doc_id}/download")
def download_document(
    doc_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    doc = db.query(DocumentDB).filter(DocumentDB.id == doc_id, DocumentDB.userId == user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if not os.path.exists(doc.storageRef):
        raise HTTPException(status_code=404, detail="File physically missing from server")
        
    return FileResponse(doc.storageRef, media_type=doc.fileType, filename=doc.fileName)

@app.delete("/api/documents/{doc_id}", status_code=204)
def delete_document(doc_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    doc = db.query(DocumentDB).filter(DocumentDB.id == doc_id, DocumentDB.userId == user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if os.path.exists(doc.storageRef):
        try:
            os.remove(doc.storageRef)
        except Exception:
            pass
            
    db.delete(doc)
    db.commit()
    return None

# ---------------------------------------------------------
# Reminder Endpoints
# ---------------------------------------------------------

@app.get("/api/reminders", response_model=List[ReminderOut])
def get_reminders(applicationId: Optional[str] = None, isCompleted: Optional[bool] = None, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    query = db.query(ReminderDB).filter(ReminderDB.userId == user_id)
    if applicationId:
        query = query.filter(ReminderDB.applicationId == applicationId)
    if isCompleted is not None:
        query = query.filter(ReminderDB.isCompleted == isCompleted)
    rems = query.all()
    rems.sort(key=lambda x: x.reminderDate)
    return rems

@app.post("/api/reminders", response_model=ReminderOut, status_code=201)
def create_reminder(rem_in: ReminderCreate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    app_doc = db.query(ApplicationDB).filter(ApplicationDB.id == rem_in.applicationId, ApplicationDB.userId == user_id).first()
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found or access denied")
        
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    new_rem = ReminderDB(
        id=f"rem-{uuid.uuid4().hex[:10]}",
        userId=user_id,
        createdAt=now,
        isCompleted=False,
        **rem_in.model_dump(exclude_none=True)
    )
    db.add(new_rem)
    db.commit()
    db.refresh(new_rem)
    return new_rem

@app.patch("/api/reminders/{rem_id}", response_model=ReminderOut)
def update_reminder(rem_id: str, rem_in: ReminderUpdate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    rem = db.query(ReminderDB).filter(ReminderDB.id == rem_id, ReminderDB.userId == user_id).first()
    if not rem:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    update_data = rem_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rem, key, value)
    
    db.commit()
    db.refresh(rem)
    return rem

@app.delete("/api/reminders/{rem_id}", status_code=204)
def delete_reminder(rem_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    rem = db.query(ReminderDB).filter(ReminderDB.id == rem_id, ReminderDB.userId == user_id).first()
    if not rem:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(rem)
    db.commit()
    return None

# ---------------------------------------------------------
# Offers: comparison data + AI negotiation coach
# ---------------------------------------------------------

OfferStatus = Literal["Pending", "Negotiating", "Accepted", "Declined"]
WorkMode = Literal["Remote", "Hybrid", "On-site"]
_MONEY_MAX = 1_000_000_000
# Columns that may legitimately be set to NULL; every other None in a PATCH is ignored.
_OFFER_NULLABLE = {"applicationId", "location", "ptoDays", "deadline", "notes", "negotiationPlan"}


class OfferBase(BaseModel):
    applicationId: Optional[str] = Field(default=None, max_length=100)
    company: str = Field(..., min_length=1, max_length=100)
    jobTitle: str = Field(..., min_length=1, max_length=150)
    location: Optional[str] = Field(default=None, max_length=100)
    workMode: WorkMode = "Hybrid"
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    baseSalary: float = Field(default=0, ge=0, le=_MONEY_MAX)
    annualBonus: float = Field(default=0, ge=0, le=_MONEY_MAX)
    signingBonus: float = Field(default=0, ge=0, le=_MONEY_MAX)
    equityValue: float = Field(default=0, ge=0, le=_MONEY_MAX)
    equityVestYears: float = Field(default=4, gt=0, le=10)
    retirementMatchPct: float = Field(default=0, ge=0, le=100)
    otherBenefitsValue: float = Field(default=0, ge=0, le=_MONEY_MAX)
    ptoDays: Optional[int] = Field(default=None, ge=0, le=366)
    growthRating: int = Field(default=3, ge=1, le=5)
    workLifeRating: int = Field(default=3, ge=1, le=5)
    cultureRating: int = Field(default=3, ge=1, le=5)
    deadline: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    status: OfferStatus = "Pending"
    notes: Optional[str] = Field(default=None, max_length=2000)


class OfferCreate(OfferBase):
    pass


class OfferUpdate(BaseModel):
    applicationId: Optional[str] = Field(default=None, max_length=100)
    company: Optional[str] = Field(default=None, min_length=1, max_length=100)
    jobTitle: Optional[str] = Field(default=None, min_length=1, max_length=150)
    location: Optional[str] = Field(default=None, max_length=100)
    workMode: Optional[WorkMode] = None
    currency: Optional[str] = Field(default=None, pattern=r"^[A-Z]{3}$")
    baseSalary: Optional[float] = Field(default=None, ge=0, le=_MONEY_MAX)
    annualBonus: Optional[float] = Field(default=None, ge=0, le=_MONEY_MAX)
    signingBonus: Optional[float] = Field(default=None, ge=0, le=_MONEY_MAX)
    equityValue: Optional[float] = Field(default=None, ge=0, le=_MONEY_MAX)
    equityVestYears: Optional[float] = Field(default=None, gt=0, le=10)
    retirementMatchPct: Optional[float] = Field(default=None, ge=0, le=100)
    otherBenefitsValue: Optional[float] = Field(default=None, ge=0, le=_MONEY_MAX)
    ptoDays: Optional[int] = Field(default=None, ge=0, le=366)
    growthRating: Optional[int] = Field(default=None, ge=1, le=5)
    workLifeRating: Optional[int] = Field(default=None, ge=1, le=5)
    cultureRating: Optional[int] = Field(default=None, ge=1, le=5)
    deadline: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    status: Optional[OfferStatus] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    negotiationPlan: Optional[str] = Field(default=None, max_length=30000)


class OfferOut(OfferBase):
    id: str
    userId: str
    negotiationPlan: Optional[str] = None
    createdAt: str
    updatedAt: str

    @computed_field  # type: ignore[misc]
    @property
    def annualTotalComp(self) -> float:
        return annual_total_comp(
            self.baseSalary,
            self.annualBonus,
            self.equityValue,
            self.equityVestYears,
            self.retirementMatchPct,
            self.otherBenefitsValue,
        )

    class Config:
        from_attributes = True


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _require_owned_application(db: Session, user_id: str, application_id: Optional[str]) -> None:
    if not application_id:
        return
    owned = db.query(ApplicationDB.id).filter(ApplicationDB.id == application_id, ApplicationDB.userId == user_id).first()
    if not owned:
        raise HTTPException(status_code=404, detail="Application not found or access denied")


@app.get("/api/offers", response_model=List[OfferOut])
def get_offers(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    offers = db.query(OfferDB).filter(OfferDB.userId == user_id).all()
    offers.sort(key=lambda o: o.createdAt, reverse=True)
    return offers


@app.get("/api/offers/{offer_id}", response_model=OfferOut)
def get_offer(offer_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    offer = db.query(OfferDB).filter(OfferDB.id == offer_id, OfferDB.userId == user_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@app.post("/api/offers", response_model=OfferOut, status_code=201)
def create_offer(offer_in: OfferCreate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    _require_owned_application(db, user_id, offer_in.applicationId)
    now = _utc_now()
    offer = OfferDB(id=f"offer-{uuid.uuid4().hex[:10]}", userId=user_id, createdAt=now, updatedAt=now, **offer_in.model_dump())
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


@app.patch("/api/offers/{offer_id}", response_model=OfferOut)
def update_offer(offer_id: str, offer_in: OfferUpdate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    offer = db.query(OfferDB).filter(OfferDB.id == offer_id, OfferDB.userId == user_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    changes = offer_in.model_dump(exclude_unset=True)
    if changes.get("applicationId"):
        _require_owned_application(db, user_id, changes["applicationId"])
    for key, value in changes.items():
        if value is None and key not in _OFFER_NULLABLE:
            continue
        setattr(offer, key, value)
    offer.updatedAt = _utc_now()
    db.commit()
    db.refresh(offer)
    return offer


@app.delete("/api/offers/{offer_id}", status_code=204)
def delete_offer(offer_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    offer = db.query(OfferDB).filter(OfferDB.id == offer_id, OfferDB.userId == user_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    db.delete(offer)
    db.commit()
    return None


class CompetingOfferIn(BaseModel):
    company: str = Field(..., min_length=1, max_length=100)
    baseSalary: float = Field(default=0, ge=0, le=_MONEY_MAX)
    totalComp: float = Field(default=0, ge=0, le=_MONEY_MAX)


class AINegotiationRequest(BaseModel):
    applicantName: str = Field(default="", max_length=100)
    company: str = Field(..., min_length=1, max_length=100)
    jobTitle: str = Field(..., min_length=1, max_length=150)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    baseSalary: float = Field(..., gt=0, le=_MONEY_MAX)
    annualBonus: float = Field(default=0, ge=0, le=_MONEY_MAX)
    signingBonus: float = Field(default=0, ge=0, le=_MONEY_MAX)
    equityValue: float = Field(default=0, ge=0, le=_MONEY_MAX)
    equityVestYears: float = Field(default=4, gt=0, le=10)
    ptoDays: Optional[int] = Field(default=None, ge=0, le=366)
    workMode: Optional[str] = Field(default=None, max_length=20)
    targetBase: Optional[float] = Field(default=None, ge=0, le=_MONEY_MAX)
    tone: str = "collaborative"
    leverage: Optional[str] = Field(default=None, max_length=1500)
    candidateHighlights: Optional[str] = Field(default=None, max_length=3000)
    competingOffers: List[CompetingOfferIn] = Field(default_factory=list, max_length=4)
    priorities: List[str] = Field(default_factory=list, max_length=5)


@app.post("/api/ai/negotiate")
async def ai_negotiate(request: AINegotiationRequest, user_id: str = Depends(get_current_user_id)):
    if not gemini_service.is_configured():
        raise HTTPException(status_code=503, detail="Gemini AI service unavailable")
    ctx = request.model_dump()
    ctx["tone"] = tone_or_default(request.tone, TONES_NEGOTIATION, "collaborative")
    ctx["priorities"] = [p.strip()[:40] for p in request.priorities if p.strip()]
    return await gemini_service.generate_negotiation_plan(ctx)


# ---------------------------------------------------------
# Smart follow-ups: settings, send log, AI drafting
# ---------------------------------------------------------

FollowUpTone = Literal["polite", "friendly", "direct"]
FollowUpChannel = Literal["email", "linkedin", "call", "other"]


class FollowUpSettingsIn(BaseModel):
    enabled: bool = True
    appliedDays: int = Field(default=7, ge=1, le=90)
    underReviewDays: int = Field(default=10, ge=1, le=90)
    interviewDays: int = Field(default=4, ge=1, le=90)
    maxFollowUps: int = Field(default=3, ge=1, le=10)
    autoCreateReminders: bool = True
    defaultTone: FollowUpTone = "polite"


class FollowUpSettingsOut(FollowUpSettingsIn):
    updatedAt: Optional[str] = None

    class Config:
        from_attributes = True


class FollowUpLogCreate(BaseModel):
    applicationId: str = Field(..., min_length=1, max_length=100)
    channel: FollowUpChannel = "email"
    tone: Optional[str] = Field(default=None, max_length=20)
    subject: Optional[str] = Field(default=None, max_length=200)
    body: Optional[str] = Field(default=None, max_length=5000)
    note: Optional[str] = Field(default=None, max_length=1000)


class FollowUpLogOut(BaseModel):
    id: str
    userId: str
    applicationId: str
    channel: str
    tone: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    note: Optional[str] = None
    createdAt: str

    class Config:
        from_attributes = True


class AIFollowUpRequest(BaseModel):
    applicantName: str = Field(default="", max_length=100)
    recruiterName: Optional[str] = Field(default=None, max_length=100)
    company: str = Field(..., min_length=1, max_length=100)
    jobTitle: str = Field(..., min_length=1, max_length=150)
    status: str = Field(default="Applied", max_length=30)
    daysQuiet: int = Field(default=0, ge=0, le=3650)
    followUpNumber: int = Field(default=1, ge=1, le=10)
    tone: str = "polite"
    channel: str = "email"
    notes: Optional[str] = Field(default=None, max_length=1500)
    jobDescription: Optional[str] = Field(default=None, max_length=1500)


@app.get("/api/followups/settings", response_model=FollowUpSettingsOut)
def get_followup_settings(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    row = db.query(FollowUpSettingsDB).filter(FollowUpSettingsDB.userId == user_id).first()
    if not row:
        return FollowUpSettingsOut()
    return row


@app.put("/api/followups/settings", response_model=FollowUpSettingsOut)
def put_followup_settings(settings_in: FollowUpSettingsIn, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    row = db.query(FollowUpSettingsDB).filter(FollowUpSettingsDB.userId == user_id).first()
    if not row:
        row = FollowUpSettingsDB(userId=user_id)
        db.add(row)
    for key, value in settings_in.model_dump().items():
        setattr(row, key, value)
    row.updatedAt = _utc_now()
    db.commit()
    db.refresh(row)
    return row


@app.get("/api/followups/logs", response_model=List[FollowUpLogOut])
def get_followup_logs(applicationId: Optional[str] = None, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    query = db.query(FollowUpLogDB).filter(FollowUpLogDB.userId == user_id)
    if applicationId:
        query = query.filter(FollowUpLogDB.applicationId == applicationId)
    logs = query.all()
    logs.sort(key=lambda entry: entry.createdAt, reverse=True)
    return logs


@app.post("/api/followups/logs", response_model=FollowUpLogOut, status_code=201)
def create_followup_log(log_in: FollowUpLogCreate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    _require_owned_application(db, user_id, log_in.applicationId)
    log = FollowUpLogDB(id=f"fu-{uuid.uuid4().hex[:10]}", userId=user_id, createdAt=_utc_now(), **log_in.model_dump())
    db.add(log)
    # A follow-up counts as activity: bump the application so its quiet-clock restarts.
    app_row = db.query(ApplicationDB).filter(ApplicationDB.id == log_in.applicationId, ApplicationDB.userId == user_id).first()
    if app_row:
        app_row.updatedAt = log.createdAt
    db.commit()
    db.refresh(log)
    return log


@app.delete("/api/followups/logs/{log_id}", status_code=204)
def delete_followup_log(log_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    log = db.query(FollowUpLogDB).filter(FollowUpLogDB.id == log_id, FollowUpLogDB.userId == user_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Follow-up log not found")
    db.delete(log)
    db.commit()
    return None


@app.post("/api/ai/followup-email")
async def ai_followup_email(request: AIFollowUpRequest, user_id: str = Depends(get_current_user_id)):
    if not gemini_service.is_configured():
        raise HTTPException(status_code=503, detail="Gemini AI service unavailable")
    ctx = request.model_dump()
    ctx["tone"] = tone_or_default(request.tone, TONES_FOLLOWUP, "polite")
    ctx["channel"] = request.channel if request.channel in ("email", "linkedin") else "email"
    return await gemini_service.generate_followup_email(ctx)


# ---------------------------------------------------------
# Dashboard Stats Endpoint
# ---------------------------------------------------------

@app.get("/api/dashboard/stats", response_model=DashboardStatsOut)
def get_dashboard_stats(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    apps = db.query(ApplicationDB).filter(ApplicationDB.userId == user_id).all()
    today = datetime.now(timezone.utc).isoformat()[:10]
    
    byStatus = {
        "saved": len([a for a in apps if a.status == "Saved"]),
        "applied": len([a for a in apps if a.status == "Applied"]),
        "underReview": len([a for a in apps if a.status == "Under Review"]),
        "interview": len([a for a in apps if a.status == "Interview"]),
        "offer": len([a for a in apps if a.status == "Offer"]),
        "rejected": len([a for a in apps if a.status == "Rejected"]),
    }
    
    apps_sorted_by_date = sorted(apps, key=lambda x: x.createdAt, reverse=True)
    recentApplications = apps_sorted_by_date[:5]
    
    upcomingFollowUps = [a for a in apps if a.followUpDate and a.followUpDate >= today]
    upcomingFollowUps.sort(key=lambda x: x.followUpDate)
    upcomingFollowUps = upcomingFollowUps[:5]
    
    return {
        "totalApplications": len(apps),
        "byStatus": byStatus,
        "recentApplications": recentApplications,
        "upcomingFollowUps": upcomingFollowUps,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5117, reload=True)
