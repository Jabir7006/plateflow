import bcrypt from "bcrypt";

export const hashValue = async (value: string, saltRound: number = 10) => {
  return await bcrypt.hash(value, saltRound);
};

export const compareValue = async (value: string, hash: string) => {
  return await bcrypt.compare(value, hash);
};
