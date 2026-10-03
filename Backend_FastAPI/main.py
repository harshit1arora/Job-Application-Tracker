import os
import uuid
import shutil
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Header, HTTPException, Query, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship

SQLALCHEMY_DATABASE_URL = "sqlite:///./jobtracker.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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

# Create the database tables
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------
# FastAPI Setup
# ---------------------------------------------------------

app = FastAPI(title="JobTracker FastAPI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
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

DEVELOPMENT_MODE = os.environ.get("DEMO_MODE", "true").lower() == "true"

def get_user_id(x_user_id: str = Header(None, alias="X-User-Id")):
    if not DEVELOPMENT_MODE:
        # In a real production environment, this would verify a Firebase ID Token 
        # from an Authorization header using the firebase-admin SDK.
        raise HTTPException(status_code=401, detail="X-User-Id raw authentication is only allowed in DEVELOPMENT_MODE")
        
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header missing")
    return x_user_id

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

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# ---------------------------------------------------------
# Application Endpoints
# ---------------------------------------------------------

@app.get("/api/applications", response_model=List[ApplicationOut])
def get_applications(
    status: Optional[str] = None,
    applicationSource: Optional[str] = None,
    search: Optional[str] = None,
    user_id: str = Depends(get_user_id),
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
def get_application(app_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    app_doc = db.query(ApplicationDB).filter(ApplicationDB.id == app_id, ApplicationDB.userId == user_id).first()
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    return app_doc

@app.post("/api/applications", response_model=ApplicationOut, status_code=201)
def create_application(app_in: ApplicationCreate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    now = datetime.utcnow().isoformat() + "Z"
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
def update_application(app_id: str, app_in: ApplicationUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    app_doc = db.query(ApplicationDB).filter(ApplicationDB.id == app_id, ApplicationDB.userId == user_id).first()
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    
    update_data = app_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(app_doc, key, value)
    
    app_doc.updatedAt = datetime.utcnow().isoformat() + "Z"
    db.commit()
    db.refresh(app_doc)
    return app_doc

@app.delete("/api/applications/{app_id}", status_code=204)
def delete_application(app_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
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

    db.delete(app_doc)
    db.commit()
    return None

# ---------------------------------------------------------
# Document Endpoints
# ---------------------------------------------------------

@app.get("/api/documents", response_model=List[DocumentOut])
def get_documents(applicationId: Optional[str] = None, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    query = db.query(DocumentDB).filter(DocumentDB.userId == user_id)
    if applicationId:
        query = query.filter(DocumentDB.applicationId == applicationId)
    return query.order_by(DocumentDB.createdAt.desc()).all()

@app.post("/api/documents/upload", response_model=DocumentOut, status_code=201)
def upload_document(
    file: UploadFile = File(...),
    applicationId: Optional[str] = Form(None),
    displayName: Optional[str] = Form(None),
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    if applicationId:
        app_doc = db.query(ApplicationDB).filter(ApplicationDB.id == applicationId, ApplicationDB.userId == user_id).first()
        if not app_doc:
            raise HTTPException(status_code=404, detail="Application not found or access denied")
    
    file_id = uuid.uuid4().hex
    safe_filename = "".join(c for c in (file.filename or "") if c.isalnum() or c in " ._-")
    if not safe_filename:
        safe_filename = "document.file"
        
    storage_path = os.path.join(UPLOAD_DIR, f"{file_id}_{safe_filename}")
    
    with open(storage_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_size = os.path.getsize(storage_path)
    
    now = datetime.utcnow().isoformat() + "Z"
    new_doc = DocumentDB(
        id=f"doc-{file_id[:10]}",
        userId=user_id,
        applicationId=applicationId,
        fileName=file.filename or safe_filename,
        fileType=file.content_type or "application/octet-stream",
        fileSize=file_size,
        storageRef=storage_path,
        displayName=displayName,
        createdAt=now
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc

@app.get("/api/documents/{doc_id}/download")
def download_document(
    doc_id: str,
    userId: str = Query(..., alias="userId"), # Need this from query string because it's a direct browser link
    db: Session = Depends(get_db)
):
    doc = db.query(DocumentDB).filter(DocumentDB.id == doc_id, DocumentDB.userId == userId).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if not os.path.exists(doc.storageRef):
        raise HTTPException(status_code=404, detail="File physically missing from server")
        
    return FileResponse(doc.storageRef, media_type=doc.fileType, filename=doc.fileName)

@app.delete("/api/documents/{doc_id}", status_code=204)
def delete_document(doc_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
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
def get_reminders(applicationId: Optional[str] = None, isCompleted: Optional[bool] = None, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    query = db.query(ReminderDB).filter(ReminderDB.userId == user_id)
    if applicationId:
        query = query.filter(ReminderDB.applicationId == applicationId)
    if isCompleted is not None:
        query = query.filter(ReminderDB.isCompleted == isCompleted)
    rems = query.all()
    rems.sort(key=lambda x: x.reminderDate)
    return rems

@app.post("/api/reminders", response_model=ReminderOut, status_code=201)
def create_reminder(rem_in: ReminderCreate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    app_doc = db.query(ApplicationDB).filter(ApplicationDB.id == rem_in.applicationId, ApplicationDB.userId == user_id).first()
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found or access denied")
        
    now = datetime.utcnow().isoformat() + "Z"
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
def update_reminder(rem_id: str, rem_in: ReminderUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
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
def delete_reminder(rem_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    rem = db.query(ReminderDB).filter(ReminderDB.id == rem_id, ReminderDB.userId == user_id).first()
    if not rem:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(rem)
    db.commit()
    return None

# ---------------------------------------------------------
# Dashboard Stats Endpoint
# ---------------------------------------------------------

@app.get("/api/dashboard/stats", response_model=DashboardStatsOut)
def get_dashboard_stats(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    apps = db.query(ApplicationDB).filter(ApplicationDB.userId == user_id).all()
    today = datetime.utcnow().isoformat()[:10]
    
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
