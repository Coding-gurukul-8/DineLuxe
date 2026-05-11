/* Shared API types */
export class ApiError extends Error {
    statusCode;
    code;
    field;
    constructor(statusCode, code, message, field) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.field = field;
        this.name = "ApiError";
    }
}
