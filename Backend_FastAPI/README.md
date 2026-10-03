# FastAPI Backend for Job Application Tracker

This is the Python FastAPI backend, replacing the .NET backend.
It uses SQLite for local data persistence.

## Setup

1. **Install Python 3.9+**
2. **Install dependencies:**
   ```bash
   cd Backend_FastAPI
   pip install -r requirements.txt
   ```
3. **Run the API Server:**
   ```bash
   python main.py
   ```
   *Alternatively:*
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 5117 --reload
   ```

The server runs on `http://localhost:5117`, meaning your existing frontend proxy (`vite.config.ts`) and API client will connect seamlessly.
You can view the interactive API documentation (Swagger UI) at `http://localhost:5117/docs`.

## Update package.json (Optional)
To use this backend alongside the frontend, you can update your root `package.json` scripts:
```json
  "scripts": {
    "dev": "npm --prefix Frontend run dev",
    "backend": "cd Backend_FastAPI && uvicorn main:app --port 5117 --reload",
    "start:all": "concurrently \"npm --prefix Frontend run dev\" \"npm run backend\""
  }
```
