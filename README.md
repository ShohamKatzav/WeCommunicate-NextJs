# websocket-express-next.js

## Overview

My project utilizes Express.js for the backend and Next.js for the frontend.
Users can securely connect using a username and password.
In the event that the username doesn't exist, they have the option to create a new user.
User data, including passwords and messages, is now stored with MongoDB. Importantly, passwords are securely hashed before storage.
Upon successful login, users receive a JWT (JSON Web Token) stored in their browser for subsequent authentication requests.
Once authenticated, users are seamlessly directed to a chat page, leveraging Socket.IO for real-time communication.

## Getting Started:

1. **Clone the repository:**

   ```
   git clone https://github.com/ShohamKatzav/websocket-express-next.js.git
   ```

2. **Install dependencies:**
    ```
    cd websocket-express-next.js
    npm install
    npm init
    ```
3. **Set Up Environment Variables:**

* For the client-side (Next.js), create a `.env` file in the `client` directory.

```env
NEXT_PUBLIC_BASE_ADDRESS="http://localhost:5000/"
NEXT_PUBLIC_BASE_PATH="http://localhost:5000/api/v1"
```

* For the server-side (Express.js), create a `.env` file in the `server` directory.

```env
TOKEN_SECRET=*your_jwt_secret_key*
DB_URI=*your_mongodb_uri*
```

You can generate a random secret key using `crypto` module.

```javascript
const crypto = require('crypto');
const generateRandomSecret = () => {
    return crypto.randomBytes(64).toString('hex');
};
```

4. **Run the Application:**

* Navigate to the root directory of the project and run the following command:
  ```
  npm start
  ```
5. **Access the Application:**

* Open your web browser and go to http://localhost:3000.

6. **Explore the Features:**

* Navigate to the login page, create a new user if needed, and experience the seamless authentication process.
* Upon successful login, you will be redirected to the chat page built with Socket.IO for real-time communication.

7. **Testing:**

   For the best testing experience, I recommend using two different browsers to simulate real-time chat interactions.
   You can use the following login details for testing purposes:

1. **User 1:**
* **Username:** shoham@gmail.com
* **Password:** 12345678
2. **User 2:**
* **Username:** skgladiator3@gmail.com
* **Password:** 12345678
