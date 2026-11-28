-- How many shares each person takes in a SHARES split; null for other methods
ALTER TABLE "ExpenseParticipant" ADD COLUMN "shares" INTEGER;
