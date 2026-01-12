# GJ Fadezz Backend Server

Backend API server that connects to Supabase and provides endpoints for the booking system.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your Supabase credentials:
   - `SUPABASE_URL`: Your Supabase project URL (from Supabase Dashboard > Settings > API)
   - `SUPABASE_ANON_KEY`: Your Supabase anon/public key (from Supabase Dashboard > Settings > API)

### 3. Start the Server

```bash
npm start
```

The server will run on `http://localhost:3000` by default.

## API Endpoints

### Availability

- **GET /api/availability** - Get availability for date range
  - Query params: `startDate` (optional), `endDate` (optional)
  - Example: `GET /api/availability?startDate=2024-01-15&endDate=2024-01-28`

- **POST /api/availability** - Create or update availability
  - Body: `{ date: "2024-01-15", timeRanges: [...], isClosed: false }`

### Appointments

- **GET /api/appointments** - Get all appointments
  - Query params: `status` (optional), `startDate` (optional), `endDate` (optional)
  - Example: `GET /api/appointments?status=pending`

- **POST /api/appointments** - Create new booking
  - Body: `{ customer: {...}, service: "...", date: "2024-01-15", time: "14:15", ... }`

- **PATCH /api/appointments/:id** - Update appointment status
  - Body: `{ status: "accepted" }` or `{ status: "declined" }`

## Testing

You can test the API using:
- Browser (for GET requests)
- Postman
- curl command line tool
- Your frontend application

Example curl command:
```bash
curl http://localhost:3000/api/availability
```

