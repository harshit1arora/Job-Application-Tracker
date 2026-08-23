# JobTracker.Api — Backend REST API

ASP.NET Core Web API providing CRUD endpoints for the AI Job Application
Tracker. Replaces the frontend's direct Firestore calls with a server-side
API layer.

**Target framework:** .NET 10 · **Language:** C#

---

## Running locally

Requires the .NET 10 SDK.

```bash
cd Backend
dotnet run --project JobTracker.Api
```

The API starts on `http://localhost:5117`.

`JobTracker.Api/JobTracker.Api.http` contains ready-made requests for every
endpoint — open it in Rider or Visual Studio and run them individually.

---

## Endpoints

All routes are prefixed `/api`. Request and response bodies use camelCase,
matching the interfaces in `Frontend/src/lib/types.ts`.

### Applications

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/applications` | Supports `?status=`, `?applicationSource=`, `?search=` |
| GET | `/applications/{id}` | |
| POST | `/applications` | Returns 201 with `Location` header |
| PATCH | `/applications/{id}` | Only supplied fields are changed |

No DELETE endpoint — `firestore.rules` sets `allow delete: if false` for this
collection, so deleting applications is not supported by design.

### Documents

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/documents` | Supports `?applicationId=` |
| GET | `/documents/{id}` | |
| POST | `/documents` | Registers metadata for an already-uploaded file |
| DELETE | `/documents/{id}` | Returns 204 |

`storageRef` is accepted on create but never returned in responses
(`[JsonIgnore]`), matching the frontend contract where the UI receives a
signed download URL instead of the raw storage path.

### Reminders

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/reminders` | Supports `?applicationId=`, `?isCompleted=` |
| GET | `/reminders/{id}` | |
| POST | `/reminders` | `isCompleted` defaults to false |
| PATCH | `/reminders/{id}` | Main use is marking complete |
| DELETE | `/reminders/{id}` | Returns 204 |

---

## Validation

Request bodies are validated with DataAnnotations attributes on the DTOs,
mirroring the Zod schemas in `Frontend/src/lib/validation.ts`. `[ApiController]`
rejects invalid requests before controller code runs, returning 400 with
field-level messages:

```json
{
  "status": 400,
  "errors": {
    "FileType": ["Only PDF and Word documents (.doc, .docx) are supported"]
  }
}
```

## Status codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created — includes `Location` header |
| 204 | Deleted, no content returned |
| 400 | Validation failure |
| 404 | Not found, or owned by another user |

404 rather than 403 is deliberate for records belonging to other users — a 403
would confirm the ID exists and leak information about other users' data.

---

## Architecture

Three classes per concept rather than one: what a client may *send* differs
from what the server *stores*. The request DTOs have no `id`, `userId`,
`createdAt` or `matchScore`, so those cannot be set by a caller.

`matchScore` on applications is reserved for the AI module and is never
written by this API.

## Storage

Storage sits behind `IApplicationRepository`, `IDocumentRepository` and
`IReminderRepository`. The current implementations are in-memory, so **data
does not survive a restart**.

Moving to Firestore means adding classes that implement the same interfaces
and changing three lines in `Program.cs`:

```csharp
builder.Services.AddSingleton<IApplicationRepository, FirestoreApplicationRepository>();
```

No controller changes are required. This is the Dependency Inversion
Principle — the controllers depend on the abstraction, not the storage.

## Not yet implemented

- **Firestore persistence** — interfaces are in place, awaiting service
  account credentials
- **Firebase auth** — every query filters on a user ID, currently a constant
  (`TempUserId`). This will come from a verified Firebase ID token
- **CORS** — needed before the frontend can call this API from the browser