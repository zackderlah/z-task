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
        console.log('=== REGISTER API CALLED ===');
        console.log('Request method:', req.method);
        console.log('Request headers:', req.headers);
        
        // Parse request body manually
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                console.log('Raw request body:', body);
                
                const requestData = JSON.parse(body);
                console.log('Parsed request body:', requestData);
                
                const { username, email, password } = requestData;

                if (!username || !email || !password) {
                    console.error('Missing required fields');
                    return res.status(400).json({ error: 'Username, email, and password are required' });
                }

                console.log('Attempting registration for email:', email);

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

                console.log('Registration successful for user:', data.user.email);

                // For now, just return success without creating default data
                // This will be handled by the frontend
                res.status(201).json({
                    message: 'User created successfully',
                    user: { id: data.user.id, username: username, email: email }
                });

            } catch (parseError) {
                console.error('Error parsing request body:', parseError);
                res.status(400).json({ error: 'Invalid request body' });
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
