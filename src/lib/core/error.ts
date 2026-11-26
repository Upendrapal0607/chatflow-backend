import { omit } from 'radash';

export interface AppErrorMetadata {
    key: string;
    cause?: unknown;
    details?: unknown;
    [extra: string]: unknown;
}

export class AppError extends Error {
    public readonly metadata: Record<string, unknown>;
    public readonly key: string;
    public readonly status: number = 500;
    public override readonly cause?: unknown;
    public readonly details?: unknown;

    constructor(message: string, metadata: AppErrorMetadata) {
        super(message);
        this.name = new.target.name;
        this.cause = metadata.cause;
        this.key = metadata.key;
        this.details = metadata.details;
        this.metadata = omit(metadata, ['cause', 'key', 'details']);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class BadRequestError extends AppError {
    public override readonly status = 400;
}

export class NotAuthenticatedError extends AppError {
    public override readonly status = 401;
}

export class NotAuthorizedError extends AppError {
    public override readonly status = 403;
}

export class NotFoundError extends AppError {
    public override readonly status = 404;
}

export class ConflictError extends AppError {
    public override readonly status = 409;
}

export class RateLimitError extends AppError {
    public override readonly status = 429;
}

export class InternalServerError extends AppError {
    public override readonly status = 500;
}
