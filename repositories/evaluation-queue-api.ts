import axios, { AxiosResponse } from 'axios';

const baseUrl = process.env.EVALUATION_QUEUE_API_URL;

export async function getTargetsList(): Promise<AxiosResponse<string[]>> {
  return axios.get(`${baseUrl}/storedEvaluation/targets`);
}

export async function getProcessingList(): Promise<AxiosResponse<string[]>> {
  return axios.get(`${baseUrl}/storedEvaluation/processing`);
}

export async function getCompletedList(): Promise<AxiosResponse<string[]>> {
  return axios.get(`${baseUrl}/storedEvaluation/completed`);
}

export async function postProcessingList(): Promise<AxiosResponse<string>> {
  return axios.post(`${baseUrl}/storedEvaluation/processing`);
}

export async function postCompletedList(idSet: string): Promise<AxiosResponse<void>> {
  return axios.post(`${baseUrl}/storedEvaluation/completed`, idSet, { headers: { 'Content-Type': 'text/plain' }});
}

export async function postReset(): Promise<AxiosResponse<number>> {
  return axios.post(`${baseUrl}/storedEvaluation/reset`);
}

