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
        
        const debugInfo = {
            timestamp: new Date().toISOString(),
            method: req.method,
            hasAuthHeader: !!authHeader,
            hasToken: !!token,
            tokenLength: token ? token.length : 0,
            tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
        };

        if (!token) {
            return res.status(401).json({
                ...debugInfo,
                error: 'No authentication token provided',
                message: 'Make sure you are logged in and the token is being sent'
            });
        }

        // Try to authenticate the user
        let user;
        try {
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
            
            if (authError || !authUser) {
                return res.status(401).json({
                    ...debugInfo,
                    error: 'Invalid or expired token',
                    authError: authError?.message,
                    message: 'Token is invalid or expired. Try logging in again.'
                });
            }
            
            user = authUser;
            debugInfo.userId = user.id;
            debugInfo.userEmail = user.email;
            
        } catch (authError) {
            return res.status(401).json({
                ...debugInfo,
                error: 'Authentication failed',
                authError: authError.message,
                message: 'Failed to authenticate user with provided token'
            });
        }

        // Try to get user data
        try {
            const { data: folders, error: foldersError } = await supabase
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
                .eq('user_id', user.id)
                .order('name');

            const { data: uncategorized, error: uncategorizedError } = await supabase
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
                .eq('user_id', user.id)
                .is('project_folders.project_id', null)
                .order('name');

            res.json({
                ...debugInfo,
                success: true,
                data: {
                    folders: folders || [],
                    uncategorized: uncategorized || [],
                    foldersCount: folders ? folders.length : 0,
                    uncategorizedCount: uncategorized ? uncategorized.length : 0,
                    totalProjects: (folders ? folders.length : 0) + (uncategorized ? uncategorized.length : 0)
                },
                errors: {
                    foldersError: foldersError?.message,
                    uncategorizedError: uncategorizedError?.message
                }
            });

        } catch (dataError) {
            res.status(500).json({
                ...debugInfo,
                error: 'Failed to fetch user data',
                dataError: dataError.message,
                message: 'Database query failed'
            });
        }

    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
};
