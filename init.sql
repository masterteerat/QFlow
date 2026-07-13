CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50)
);

INSERT INTO users (name, role) VALUES 
('Student A', 'Developer'), 
('Student B', 'Database Admin');