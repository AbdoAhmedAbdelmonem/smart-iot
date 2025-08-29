-- Create the meow table for IoT sensor logs
CREATE TABLE IF NOT EXISTS public.meow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_type TEXT NOT NULL,
  sensor_value NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT DEFAULT 'esp32',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.meow ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (since this is IoT sensor data)
CREATE POLICY "Allow public read access to meow table" 
ON public.meow FOR SELECT 
USING (true);

-- Create policy for insert (for IoT devices to log data)
CREATE POLICY "Allow public insert to meow table" 
ON public.meow FOR INSERT 
WITH CHECK (true);

-- Create index for better performance on timestamp queries
CREATE INDEX IF NOT EXISTS idx_meow_timestamp ON public.meow(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_meow_sensor_type ON public.meow(sensor_type);
