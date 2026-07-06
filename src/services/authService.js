import axios from "axios";

const API_URL = "http://localhost:5000/api/auth";


export const registerUser = async(data)=>{

const response = await axios.post(

`${API_URL}/register`,
data

);

return response.data;

};



export const getProfile = async(token)=>{


const response = await axios.get(

`${API_URL}/me`,


{

headers:{
Authorization:`Bearer ${token}`
}

}


);


return response.data;

};