-- Create a simple user_data table for storing JSON data
CREATE TABLE IF NOT EXISTS user_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);

-- Enable RLS
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own data" ON user_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own data" ON user_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own data" ON user_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own data" ON user_data FOR DELETE USING (auth.uid() = user_id);
