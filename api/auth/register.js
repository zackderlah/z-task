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
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (error) {
            console.error('Supabase signup error:', error);
            return res.status(400).json({ error: error.message });
        }

        // Create default folder and project for new user
        const userId = data.user.id;

        // Create default folder
        const { data: folderData, error: folderError } = await supabase
            .from('folders')
            .insert({ user_id: userId, name: 'Default', expanded: true })
            .select()
            .single();

        if (folderError) {
            console.error('Error creating default folder:', folderError);
        }

        const folderId = folderData ? folderData.id : null;

        // Create default project
        const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .insert({ user_id: userId, name: 'My First Project' })
            .select()
            .single();

        if (projectError) {
            console.error('Error creating default project:', projectError);
        }

        const projectId = projectData ? projectData.id : null;

        // Link project to folder
        if (projectId && folderId) {
            await supabase.from('project_folders').insert({ project_id: projectId, folder_id: folderId });
        }

        // Create default columns
        const defaultColumns = [
            { title: 'TODO', tag: 'todo', position: 0 },
            { title: 'IN PROGRESS', tag: 'in-progress', position: 1 },
            { title: 'DONE', tag: 'done', position: 2 }
        ];

        for (const column of defaultColumns) {
            await supabase.from('columns').insert({
                project_id: projectId,
                title: column.title,
                tag: column.tag,
                position: column.position
            });
        }

        res.status(201).json({
            message: 'User created successfully',
            user: { id: userId, username: username, email: email }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
