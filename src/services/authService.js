import axios from "axios";
import { API_BASE_URL } from "./authenticatedApi";

const API_URL = `${API_BASE_URL}/auth`;


export const registerUser = async(data)=>{

const response = await axios.post(

`${API_URL}/register`,
data

);

return response.data;

};



export const getProfile = async(token)=>{


const response = await axios.get(

`${API_URL}/profile`,


{

headers:{
Authorization:`Bearer ${token}`
}

}


);


return response.data;

};
