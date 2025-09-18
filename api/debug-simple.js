const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token' });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const userId = user.id;

        // Simple queries to see what's in the database
        const { data: folders, error: foldersError } = await supabase
            .from('folders')
            .select('*')
            .eq('user_id', userId);

        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId);

        const { data: columns, error: columnsError } = await supabase
            .from('columns')
            .select('*')
            .in('project_id', projects?.map(p => p.id) || []);

        const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .in('column_id', columns?.map(c => c.id) || []);

        res.json({
            userId,
            folders: folders || [],
            projects: projects || [],
            columns: columns || [],
            tasks: tasks || [],
            errors: {
                foldersError: foldersError?.message,
                projectsError: projectsError?.message,
                columnsError: columnsError?.message,
                tasksError: tasksError?.message
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
