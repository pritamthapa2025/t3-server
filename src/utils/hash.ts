import bcrypt from "bcrypt";

// Function to hash the password before saving to the database
export const hashPassword = async (password: string): Promise<string> => {
  // Generate salt
  const salt = await bcrypt.genSalt(10);
  // Hash the password using the generated salt
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
};

// Function to compare a password with a hashed password
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};
