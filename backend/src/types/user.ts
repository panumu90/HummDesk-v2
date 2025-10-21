/**
 * User Domain Types
 *
 * User is a shared entity that can belong to multiple accounts.
 * Users are linked to accounts via the AccountUser join table.
 */

/**
 * Main User entity
 * Shared across accounts - a user can be a member of multiple accounts
 */
export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  /** Last time the user was seen online */
  last_seen_at?: Date;
  /** Hashed password (bcrypt) */
  password_hash: string;
  /** Email verification status */
  email_verified: boolean;
  /** Email verification token */
  verification_token?: string;
  /** Password reset token */
  reset_token?: string;
  /** Password reset token expiry */
  reset_token_expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * User profile information (public-facing)
 * Excludes sensitive fields like password_hash
 */
export interface UserProfile {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  last_seen_at?: Date;
  email_verified: boolean;
  created_at: Date;
}

/**
 * Request payload for user registration
 */
export interface RegisterUserRequest {
  email: string;
  name: string;
  password: string;
}

/**
 * Request payload for user login
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Response payload for successful authentication
 */
export interface AuthResponse {
  user: UserProfile;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * JWT token payload
 */
export interface JWTPayload {
  user_id: number;
  email: string;
  account_id?: number;
  role?: string;
  iat: number;
  exp: number;
}

/**
 * Request payload for updating user profile
 */
export interface UpdateUserRequest {
  name?: string;
  avatar_url?: string;
  email?: string;
}

/**
 * Request payload for password reset
 */
export interface ResetPasswordRequest {
  email: string;
}

/**
 * Request payload for confirming password reset
 */
export interface ConfirmResetPasswordRequest {
  reset_token: string;
  new_password: string;
}
