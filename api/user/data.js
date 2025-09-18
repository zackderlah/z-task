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
        // Check if authorization header is present
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        // Try to authenticate the user
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const userId = user.id;

        if (req.method === 'GET') {
            // Get user data - return default structure if no data exists
            try {
                const { data: folders, error: foldersError } = await supabase
                    .from('folders')
                    .select('*')
                    .eq('user_id', userId);

                const { data: projects, error: projectsError } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('user_id', userId);

                // If no data exists, return empty structure that matches frontend expectations
                if ((!folders || folders.length === 0) && (!projects || projects.length === 0)) {
                    res.json({
                        folders: [],
                        uncategorized: []
                    });
                } else {
                    // Convert database format to frontend format
                    const formattedFolders = (folders || []).map(folder => ({
                        id: folder.id,
                        name: folder.name,
                        expanded: folder.expanded,
                        projects: [] // We'll add projects later if needed
                    }));

                    const formattedProjects = (projects || []).map(project => ({
                        id: project.id,
                        name: project.name,
                        description: project.description,
                        columns: [] // We'll add columns later if needed
                    }));

                    res.json({
                        folders: formattedFolders,
                        uncategorized: formattedProjects
                    });
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                res.status(500).json({ error: 'Failed to fetch data' });
            }

        } else if (req.method === 'POST') {
            // Save user data - handle the full data structure
            try {
                const { folders, uncategorized } = req.body;
                console.log('Saving data:', { folders: folders?.length, uncategorized: uncategorized?.length });

                // Clear existing data
                await supabase.from('folders').delete().eq('user_id', userId);
                await supabase.from('projects').delete().eq('user_id', userId);

                // Insert new folders
                if (folders && folders.length > 0) {
                    for (const folder of folders) {
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

                        // Insert projects in this folder
                        if (folder.projects && folder.projects.length > 0) {
                            for (const project of folder.projects) {
                                await supabase.from('projects').insert({
                                    user_id: userId,
                                    name: project.name,
                                    description: project.description || ''
                                });
                            }
                        }
                    }
                }

                // Insert uncategorized projects
                if (uncategorized && uncategorized.length > 0) {
                    for (const project of uncategorized) {
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

                        // Insert columns for this project
                        if (project.columns && project.columns.length > 0) {
                            for (const column of project.columns) {
                                const { data: columnData, error: columnError } = await supabase
                                    .from('columns')
                                    .insert({
                                        project_id: projectData.id,
                                        title: column.title,
                                        tag: column.tag || '',
                                        position: column.position || 0
                                    })
                                    .select()
                                    .single();

                                if (columnError) {
                                    console.error('Error creating column:', columnError);
                                    continue;
                                }

                                // Insert tasks for this column
                                if (column.items && column.items.length > 0) {
                                    for (const item of column.items) {
                                        await supabase.from('tasks').insert({
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

                res.json({ message: 'Data saved successfully' });
            } catch (error) {
                console.error('Error saving data:', error);
                res.status(500).json({ error: 'Failed to save data' });
            }
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};