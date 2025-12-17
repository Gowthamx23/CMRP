# CMRP – Civic Issue Reporting Platform

CMRP is a full-stack web application that enables users to report and track civic issues, supporting photo uploads, geo-tagging, and role-based access (User, Official, Admin). Designed for real-world use, it leverages React for the frontend, Spring Boot for the backend, and MongoDB as its database.

## Features

- **User Roles:** User, Official, Admin, each with tailored access and dashboards
- **JWT Authentication:** Secure login and session management
- **Complaint Reporting:** Submit issues with descriptions, photos, and geo-location
- **Complaint Tracking:** Real-time status updates, progress monitoring
- **Dashboards:** Role-specific analytics and management tools
- **Optimized Database Management**

## Tech Stack

- **Frontend:** React (JavaScript)
- **Backend:** Spring Boot (Java)
- **Database:** MongoDB
- **Additional:** JWT (authentication), Photo upload handling

## Getting Started

### Prerequisites

- Node.js and npm (for frontend)
- Java & Maven (for backend)
- PostgreSQL (for database)

### Setup

#### 1. Backend (Spring Boot)

```bash
cd backend/
mvn install
mvn spring-boot:run
```
- Configure DB credentials in `application.properties`.

#### 2. Frontend (React)

```bash
cd frontend/
npm install
npm start
```
- Update API endpoints in frontend config if needed.

#### 3. Database

- Create the PostgreSQL database
- Run migrations/scripts located in `backend/db/` (if present)

### Usage

- Access the web app at [http://localhost:3000](http://localhost:3000)
- Register/log in as a user, official, or admin
- Submit complaints, view dashboards, manage civic issues

## Project Structure

```
frontend/     # React app
backend/      # Spring Boot API
db/           # Database scripts and migrations
```

## License

[MIT](LICENSE)

---

For additional documentation, API usage, or contribution guidelines, check the respective `/docs` folder or contact the maintainer.
