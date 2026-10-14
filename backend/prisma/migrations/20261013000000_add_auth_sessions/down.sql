-- Roll back only after reverting the application. New sessions will require login.
DROP TABLE "auth_sessions";
