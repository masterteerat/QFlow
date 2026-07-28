# QFlow - Global Queue Management System

A comprehensive application for managing queues across all shops worldwide.

## Overview

QFlow is a centralized queue management system designed to streamline customer queuing experiences across multiple retail locations globally. Provide your customers with efficient wait times and real-time queue status updates.

## Features

- **Multi-location Support**: Manage queues for shops in every corner of the world
- **Real-time Updates**: Customers can view current queue status online
- **Scalable Architecture**: Built on Express.js for high performance
- **Docker Ready**: Easy deployment with Docker and Docker Compose
- **RESTful API**: Simple and intuitive endpoints

## Tech Stack

- Node.js
- Express.js
- Docker
- PostgreSQL (database)

## Installation

### Prerequisites

- Node.js 16+
- Docker & Docker Compose

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd QFlow
```

2. Start the application:
```bash
docker-compose up -d
```

3. The server will start on port 3000

## Usage

Visit `http://localhost:3000` to see the queue management interface.

### API Endpoints

- `GET /` - Main endpoint
- Additional endpoints can be added for queue operations

## Project Structure

```
QFlow/
├── server.js          # Express application entry point
├── init.sql           # Database initialization script
├── Dockerfile         # Container configuration
├── docker-compose.yml # Docker orchestration
└── package.json       # Node.js dependencies
```

## Configuration

Edit `server.js` to customize:
- Port number
- API endpoints
- Queue logic

## License

MIT
