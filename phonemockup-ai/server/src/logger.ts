import bristol from "bristol";

const logger = new bristol.Bristol();
logger.addTarget("console").withFormatter("human");

export {logger};