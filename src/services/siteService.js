import api from "./axios";

export const getSites = async () => {

  const response =

    await api.get("/sites");

  return response.data;

};

export const getSite = async (id) => {

  const response =

    await api.get(`/sites/${id}`);

  return response.data;

};

export const createSite = async (data) => {

  const response =

    await api.post(

      "/sites",

      data

    );

  return response.data;

};