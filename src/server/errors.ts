export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public availableAt?: string,
  ) {
    super(message);
  }
}
