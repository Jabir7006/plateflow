class ApiResponse<T> {
  public success: boolean;
  constructor(
    public statusCode: number,
    public data: T,
    public message: string = "Success"
  ) {
    this.success = statusCode >= 200 && statusCode < 400;
  }
}

export default ApiResponse;
