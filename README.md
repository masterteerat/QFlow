# QFlow

A booking app for walk-up businesses (barbers, clinics, cafes, anything with a line).
Any shop owner can register and open bookings; customers pick a slot (or grab a
walk-in ticket) and show a QR-style ticket when they arrive.

QFlow only handles the booking step. What happens inside the shop - how staff
run their day, POS, scheduling staff, etc. - is out of scope on purpose.

## How it works

- Owners sign up, register a shop, and choose walk-in or fixed time slots.
- Customers sign up, pick a shop and a slot, and get a ticket with a queue number.
- Staff check tickets in from the owner dashboard when the customer arrives.
- Shops can optionally require a deposit before a booking is confirmed.

## Stack

- React (Vite) frontend, Tailwind for styling
- Express backend, PostgreSQL for storage
- Docker Compose for local dev

## Running locally

Requires Docker and Docker Compose.

```bash
cd Docker
docker-compose up -d
```

The app is served at `http://localhost:3000`.

## Project layout

```
QFlow/
├── App/
│   ├── backend/          # Express API
│   │   ├── config/       # DB pool
│   │   ├── controllers/  # request handlers
│   │   ├── models/       # SQL queries
│   │   └── routes/
│   └── frontend/         # React app
│       └── src/
│           ├── components/
│           ├── lib/      # fetch + auth helpers
│           └── pages/
├── SQL/
│   ├── init.sql          # schema
│   └── data.sql          # seed data
└── Docker/
```

## API

All routes are under `/api`.

**Customer**
- `POST /api/customer/signup`, `POST /api/customer/login`
- `GET /api/customer/businesses` - list shops with slot availability
- `POST /api/customer/tickets` - book a slot or take a walk-in ticket
- `GET /api/customer/tickets/:customerId`
- `PATCH /api/customer/tickets/:ticketId/cancel`

**Owner**
- `POST /api/owner/signup`, `POST /api/owner/login`
- `GET /api/owner/businesses/:ownerId`
- `POST /api/owner/businesses` - register a new shop
- `GET /api/owner/queue/:businessId` - today's waiting/serving tickets
- `PATCH /api/owner/tickets/:ticketId/checkin`
- `PATCH /api/owner/tickets/:ticketId/complete`
- `PATCH /api/owner/tickets/:ticketId/no-show`

## License

MIT
