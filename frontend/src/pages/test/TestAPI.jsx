import React, { useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const TestAPI = () => {
    const [route, setRoute] = useState('/auth/me'); // Default to a safe route
    const [method, setMethod] = useState('GET');
    const [payload, setPayload] = useState('{}');
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleTest = async () => {
        setLoading(true);
        setResponse(null);
        try {
            let res;
            const config = {
                headers: { 'Content-Type': 'application/json' }
            };

            // Parse payload if method is POST/PUT
            let data = {};
            if (method === 'POST' || method === 'PUT') {
                 try {
                     data = JSON.parse(payload);
                 } catch (e) {
                     toast.error("Invalid JSON Payload");
                     setLoading(false);
                     return;
                 }
            }

            switch (method) {
                case 'GET':
                    res = await api.get(route);
                    break;
                case 'POST':
                    res = await api.post(route, data, config);
                    break;
                case 'PUT':
                    res = await api.put(route, data, config);
                    break;
                case 'DELETE':
                    res = await api.delete(route);
                    break;
                default:
                    return;
            }

            setResponse({
                status: res.status,
                headers: res.headers,
                data: res.data
            });
            toast.success("Request Successful");

        } catch (error) {
            console.error("API Test Error:", error);
            setResponse({
                status: error.response?.status || 'Error',
                message: error.message,
                data: error.response?.data
            });
            toast.error("Request Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h2>API Tester</h2>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Route (relative to /api)</label>
                <input 
                    type="text" 
                    value={route} 
                    onChange={(e) => setRoute(e.target.value)} 
                    style={{ width: '100%', padding: '8px' }}
                />
            </div>

            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Method</label>
                <select 
                    value={method} 
                    onChange={(e) => setMethod(e.target.value)}
                    style={{ padding: '8px', width: '100%' }}
                >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                </select>
            </div>

            {(method === 'POST' || method === 'PUT') && (
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Payload (JSON)</label>
                    <textarea 
                        value={payload} 
                        onChange={(e) => setPayload(e.target.value)} 
                        rows="5"
                        style={{ width: '100%', padding: '8px', fontFamily: 'monospace' }}
                    />
                </div>
            )}

            <button 
                onClick={handleTest} 
                disabled={loading}
                style={{ 
                    padding: '10px 20px', 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    border: 'none', 
                    cursor: loading ? 'not-allowed' : 'pointer' 
                }}
            >
                {loading ? 'Sending...' : 'Send Request'}
            </button>

            {response && (
                <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                    <h3>Response</h3>
                    <p><strong>Status:</strong> {response.status}</p>
                    <pre style={{ background: '#f4f4f4', padding: '10px', overflowX: 'auto' }}>
                        {JSON.stringify(response.data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default TestAPI;
