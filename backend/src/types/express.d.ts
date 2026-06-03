declare global {
  namespace Express {
    interface Request<
      P = any,
      ResBody = any,
      ReqBody = any,
      ReqQuery = any,
      Locals extends Record<string, any> = Record<string, any>,
    > {
      user?: {
        id: string;
        email: string;
        role: string;
        restaurant_id?: string;
        branch_id?: string;
        [key: string]: unknown;
      };
      restaurantId?: string;
      branchId?: string;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request<
    P = any,
    ResBody = any,
    ReqBody = any,
    ReqQuery = any,
    Locals extends Record<string, any> = Record<string, any>,
  > {
    user?: {
      id: string;
      email: string;
      role: string;
      restaurant_id?: string;
      branch_id?: string;
      [key: string]: unknown;
    };
    restaurantId?: string;
    branchId?: string;
  }
}

