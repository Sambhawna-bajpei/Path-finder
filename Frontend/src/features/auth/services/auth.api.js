import axios from "axios";


const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "",
    withCredentials: true
})

export async function register({username,email,password}) {
    try{

    const response = await api.post('/api/auth/register',{
        username, email, password
    })

    return response.data
    }catch(err){
        throw new Error(err.response?.data?.message || "Could not create your account. Please try again.")
    }
}

export async function login({email,password}){
    try{
        const response = await api.post('/api/auth/login',{
            email, password
        })
        return response.data
    }catch(err){
        throw new Error(err.response?.data?.message || "Could not sign in. Please check your details.")
    }
}

export async function logout(){
    try{
        const response = await api.get('/api/auth/logout')
        return response.data
    }catch(err){
        throw new Error(err.response?.data?.message || "Could not sign out.")
    }
}

export async function getMe(){
    try{
        const response = await api.get('/api/auth/get-me')
           
        return response.data
    }catch(err){
        if (err.response?.status === 401) return null;
        throw new Error(err.response?.data?.message || "The account service is unavailable.")
    }
}
