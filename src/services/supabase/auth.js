mport { supabase } from './client'
import type { AuthCredentials, RegisterCredentials, ServiceResponse } from '../src/types/index.ts'
import type { Session, User } from '@supabase/supabase-js'

// Padrao toda funçao retorna ServiceResponde

export const authService = {
    register: async ({email, password, name}: RegisterCredentials): Promise<ServiceResponse<User>> => {
       const {data, error} = await supabase.auth.signUp({
        email,
        password,
        options: {data: {full_name: name}},
       })
       return { data: data.user, error: error?.message ?? null} 
},
    //Login com email/Senha
    login: async ({email, password}: AuthCredentials): Promise<ServiceResponde<Sessions>> => {
        const {data, erro} = await supabase.auth.signInWithPassword({email,password})
        return{data: data.session, error: erro?.message ?? null}
    },
    // Logout
    logout: async (): Promise<ServiceResponse<null>> => {
        const {error} = await supabase.auth.signOut()
        return {data: null, error: error?.message ?? null}
    },
    // Recuperação de senha - envia email
    forgotPassword: async (email: string): Promise<ServiceResponse<null>> => {
        const {error} = await supabase.auth.resetPasswordForEmail(email)
        return {data: null, error: error?.message ?? null}
    },
    //Seção Atual 
    getSession: async (): Promise<ServiceResponse<Session>> => {
        const {data, error} = await supabase.auth.getSession()
        return {data: data.session, error: error?.message ?? null}
    },
    //Escuta mudança de sessao (Loggin, logout, refresh)
    // Padrao chame no Provider global da aplicaçao
    onAuthChange: (callback: (session: Session | null) => void)=> {
        const {data} = supabase.auth.onAuthStateChange((_event,session) => callback(session))
        return data.subscription // retorna para poder chama .unsubscrebe()
    }

} 