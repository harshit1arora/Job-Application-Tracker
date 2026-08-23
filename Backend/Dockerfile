# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY JobTracker.Api/JobTracker.Api.csproj JobTracker.Api/
RUN dotnet restore JobTracker.Api/JobTracker.Api.csproj

COPY JobTracker.Api/ JobTracker.Api/
RUN dotnet publish JobTracker.Api/JobTracker.Api.csproj -c Release -o /app/publish

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_GCConserveMemory=9

# Disables FileSystemWatcher on appsettings.json — prevents SIGSEGV in containers
# where inotify is restricted (Render free tier)
ENV DOTNET_hostBuilder__reloadConfigOnChange=false

EXPOSE 10000

ENTRYPOINT ["dotnet", "JobTracker.Api.dll"]
