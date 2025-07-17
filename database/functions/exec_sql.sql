-- =====================================================
-- exec_sql Function for Supabase Migration Support
-- This function allows the migration script to execute SQL statements
-- =====================================================

-- Create the exec_sql function
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Execute the SQL statement
    EXECUTE sql;
END;
$$;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Add RLS policy if needed
-- ALTER FUNCTION public.exec_sql(text) OWNER TO postgres;