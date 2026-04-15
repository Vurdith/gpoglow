import serverless from 'serverless-http'
import { apiApp } from '../server/api.mjs'

export default serverless(apiApp)
