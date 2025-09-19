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
        console.log('=== LOGIN API CALLED ===');
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
                
                const { email, password } = requestData;

                if (!email || !password) {
                    console.error('Missing email or password');
                    return res.status(400).json({ error: 'Email and password are required' });
                }

                console.log('Attempting login for email:', email);

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) {
                    console.error('Supabase login error:', error);
                    return res.status(401).json({ error: error.message });
                }

                console.log('Login successful for user:', data.user.email);

                res.json({
                    message: 'Login successful',
                    token: data.session.access_token,
                    user: { id: data.user.id, username: data.user.user_metadata.username, email: data.user.email }
                });

            } catch (parseError) {
                console.error('Error parsing request body:', parseError);
                res.status(400).json({ error: 'Invalid request body' });
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
