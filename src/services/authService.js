import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
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
