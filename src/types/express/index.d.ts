declare namespace Express {
	export interface Request {
		decoded: {
			u_id: number;
			username: string;
		};
	}
}
