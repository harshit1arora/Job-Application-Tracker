import os
import firebase_admin
from firebase_admin import credentials, auth
from fastapi import Header, HTTPException
import logging

logger = logging.getLogger(__name__)

def initialize_firebase():
    if firebase_admin._apps:
        return
        
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")
    
    if project_id and client_email and private_key:
        try:
            private_key = private_key.replace("\\n", "\n")
            cred = credentials.Certificate({
                "type": "service_account",
                "project_id": project_id,
                "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID", ""),
                "private_key": private_key,
                "client_email": client_email,
                "client_id": os.environ.get("FIREBASE_CLIENT_ID", ""),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email.replace('@', '%40')}"
            })
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized via environment variables")
        except Exception as e:
            logger.error(
                "Firebase Admin initialization failed (%s): %s",
                type(e).__name__,
                e,
            )
    else:
        # Default initialization if no explicit env vars (e.g. relying on GOOGLE_APPLICATION_CREDENTIALS)
        try:
            firebase_admin.initialize_app()
            logger.info("Firebase Admin initialized via default mechanism")
        except Exception:
            logger.warning("Firebase Admin could not be initialized")

initialize_firebase()

def get_firebase_auth_diagnostics():
    try:
        firebase_app = firebase_admin.get_app()
    except ValueError:
        return {"firebaseAdminInitialized": False, "firebaseProjectId": None}

    return {
        "firebaseAdminInitialized": True,
        "firebaseProjectId": firebase_app.project_id,
    }

DEVELOPMENT_MODE = os.environ.get("DEMO_MODE", "false").lower() == "true"

def get_current_user_id(
    authorization: str = Header(None, alias="Authorization"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1]
        try:
            decoded_token = auth.verify_id_token(token)
            return decoded_token["uid"]
        except Exception as e:
            logger.warning(
                "Firebase ID token verification failed (%s): %s",
                type(e).__name__,
                e,
            )
            raise HTTPException(status_code=401, detail="Invalid or expired authentication token")
            
    # Fallback to X-User-Id only if in development mode
    if DEVELOPMENT_MODE and x_user_id:
        return x_user_id
        
    raise HTTPException(status_code=401, detail="Authentication required")
