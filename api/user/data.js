const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to authenticate user
const authenticateUser = async (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        throw new Error('Authentication token required');
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        throw new Error('Invalid or expired token');
    }

    return user;
};

// Helper function to get user data
const getUserData = async (userId) => {
    const { data: folders } = await supabase
        .from('folders')
        .select(`
            id, name, expanded,
            project_folders (
                projects (
                    id, name, description,
                    columns (
                        id, title, tag, position,
                        tasks (
                            id, text, description, priority, due_date, tags, completed, completed_at, position
                        )
                    )
                )
            )
        `)
        .eq('user_id', userId)
        .order('name');

    const { data: uncategorized } = await supabase
        .from('projects')
        .select(`
            id, name, description,
            columns (
                id, title, tag, position,
                tasks (
                    id, text, description, priority, due_date, tags, completed, completed_at, position
                )
            )
        `)
        .eq('user_id', userId)
        .is('project_folders.project_id', null)
        .order('name');

    return { folders, uncategorized };
};

// Helper function to save user data
const saveUserData = async (userId, data) => {
    const { folders, uncategorized } = data;

    // Clear existing data - simplified approach
    try {
        // First get all project IDs for this user
        const { data: userProjects } = await supabase
            .from('projects')
            .select('id')
            .eq('user_id', userId);

        if (userProjects && userProjects.length > 0) {
            const projectIds = userProjects.map(p => p.id);

            // Get all column IDs for these projects
            const { data: userColumns } = await supabase
                .from('columns')
                .select('id')
                .in('project_id', projectIds);

            if (userColumns && userColumns.length > 0) {
                const columnIds = userColumns.map(c => c.id);

                // Delete tasks
                await supabase.from('tasks').delete().in('column_id', columnIds);
            }

            // Delete columns
            await supabase.from('columns').delete().in('project_id', projectIds);

            // Delete project-folder relationships
            await supabase.from('project_folders').delete().in('project_id', projectIds);

            // Delete projects
            await supabase.from('projects').delete().in('id', projectIds);
        }

        // Delete folders
        await supabase.from('folders').delete().eq('user_id', userId);
    } catch (error) {
        console.error('Error clearing existing data:', error);
        // Continue with insert even if clear fails
    }

    // Insert new data
    for (const folder of folders || []) {
        try {
            const { data: folderData, error: folderError } = await supabase
                .from('folders')
                .insert({
                    user_id: userId,
                    name: folder.name,
                    expanded: folder.expanded !== false
                })
                .select()
                .single();

            if (folderError) {
                console.error('Error creating folder:', folderError);
                continue;
            }

            if (folder.projects) {
                for (const project of folder.projects) {
                    try {
                        const { data: projectData, error: projectError } = await supabase
                            .from('projects')
                            .insert({
                                user_id: userId,
                                name: project.name,
                                description: project.description || ''
                            })
                            .select()
                            .single();

                        if (projectError) {
                            console.error('Error creating project:', projectError);
                            continue;
                        }

                // Link project to folder
                await supabase
                    .from('project_folders')
                    .insert({
                        project_id: projectData.id,
                        folder_id: folderData.id
                    });

                // Insert columns and tasks
                if (project.columns) {
                    for (const column of project.columns) {
                        const { data: columnData } = await supabase
                            .from('columns')
                            .insert({
                                project_id: projectData.id,
                                title: column.title,
                                tag: column.tag || '',
                                position: column.position || 0
                            })
                            .select()
                            .single();

                        if (column.items) {
                            for (const item of column.items) {
                                await supabase
                                    .from('tasks')
                                    .insert({
                                        column_id: columnData.id,
                                        text: item.text,
                                        description: item.description || '',
                                        priority: item.priority || 'medium',
                                        due_date: item.dueDate || null,
                                        tags: item.tags || [],
                                        completed: item.completed || false,
                                        completed_at: item.completedAt || null,
                                        position: item.position || 0
                                    });
                            }
                        }
                    }
                }
            }
        }
    }

    // Insert uncategorized projects
    if (uncategorized) {
        for (const project of uncategorized) {
            try {
                const { data: projectData, error: projectError } = await supabase
                    .from('projects')
                    .insert({
                        user_id: userId,
                        name: project.name,
                        description: project.description || ''
                    })
                    .select()
                    .single();

                if (projectError) {
                    console.error('Error creating uncategorized project:', projectError);
                    continue;
                }

            if (project.columns) {
                for (const column of project.columns) {
                    const { data: columnData } = await supabase
                        .from('columns')
                        .insert({
                            project_id: projectData.id,
                            title: column.title,
                            tag: column.tag || '',
                            position: column.position || 0
                        })
                        .select()
                        .single();

                    if (column.items) {
                        for (const item of column.items) {
                            await supabase
                                .from('tasks')
                                .insert({
                                    column_id: columnData.id,
                                    text: item.text,
                                    description: item.description || '',
                                    priority: item.priority || 'medium',
                                    due_date: item.dueDate || null,
                                    tags: item.tags || [],
                                    completed: item.completed || false,
                                    completed_at: item.completedAt || null,
                                    position: item.position || 0
                                });
                        }
                    }
                }
            }
        }
    }
};

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
        const user = await authenticateUser(req);
        const userId = user.id;

        if (req.method === 'GET') {
            // Get user data
            const data = await getUserData(userId);
            res.json(data);
        } else if (req.method === 'POST') {
            // Save user data
            const userData = req.body;
            await saveUserData(userId, userData);
            res.json({ message: 'User data saved successfully' });
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('User data error:', error);
        if (error.message === 'Authentication token required' || error.message === 'Invalid or expired token') {
            res.status(401).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
