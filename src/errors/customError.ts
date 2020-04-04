class CustomError extends Error {
	constructor(
		public response: string = 'Internal server error',
		public status: number = 500,
		public description: string = '',
		public code: number = 42,
	) {
		super();
	}
}

export default CustomError;
