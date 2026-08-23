# ---- Build stage ----
FROM --platform=linux/amd64 mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY JobTracker.Api/JobTracker.Api.csproj JobTracker.Api/
RUN dotnet restore JobTracker.Api/JobTracker.Api.csproj

COPY JobTracker.Api/ JobTracker.Api/
RUN dotnet publish JobTracker.Api/JobTracker.Api.csproj -c Release -o /app/publish --runtime linux-x64 --self-contained false

# ---- Runtime stage ----
FROM --platform=linux/amd64 mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 10000

ENV ASPNETCORE_URLS=http://+:10000
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1

ENTRYPOINT ["dotnet", "JobTracker.Api.dll"]
