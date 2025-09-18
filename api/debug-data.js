const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        // Check environment variables
        const envCheck = {
            SUPABASE_URL_SET: !!supabaseUrl,
            SUPABASE_ANON_KEY_SET: !!supabaseKey,
            SUPABASE_URL_LENGTH: supabaseUrl ? supabaseUrl.length : 0,
            SUPABASE_KEY_LENGTH: supabaseKey ? supabaseKey.length : 0
        };

        // Test database connection
        const { data: tables, error: tablesError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .in('table_name', ['folders', 'projects', 'columns', 'tasks']);

        // Test auth users table
        const { data: users, error: usersError } = await supabase
            .from('auth.users')
            .select('id, email')
            .limit(5);

        // Test folders table
        const { data: folders, error: foldersError } = await supabase
            .from('folders')
            .select('*')
            .limit(5);

        // Test projects table
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select('*')
            .limit(5);

        res.json({
            timestamp: new Date().toISOString(),
            environment: envCheck,
            database_connection: {
                tables_exist: !tablesError,
                tables_found: tables ? tables.map(t => t.table_name) : [],
                tables_error: tablesError?.message
            },
            auth_users: {
                accessible: !usersError,
                count: users ? users.length : 0,
                error: usersError?.message
            },
            folders: {
                accessible: !foldersError,
                count: folders ? folders.length : 0,
                error: foldersError?.message,
                sample: folders ? folders.slice(0, 2) : []
            },
            projects: {
                accessible: !projectsError,
                count: projects ? projects.length : 0,
                error: projectsError?.message,
                sample: projects ? projects.slice(0, 2) : []
            }
        });

    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
};
