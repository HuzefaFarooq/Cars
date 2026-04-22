CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS car_enquiries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    
    car_make VARCHAR(100),
    car_model VARCHAR(100),
    car_year VARCHAR(20),

    service_type VARCHAR(100), -- MOT, repair, inspection, purchase etc
    message TEXT,

    preferred_datetime TEXT,

    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, password_hash)
VALUES ('admin', '$2b$10$JMP4ppDJ12WTe7ZUbiiU9uVWkpY5IcCgZD8RW3wnY6hRmJ/1mM0AC')
ON CONFLICT (username) DO NOTHING;
