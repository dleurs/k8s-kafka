import express from 'express';
import bodyParser from 'body-parser';
import KafkaClient, { Consumer }  from 'kafka-node';

const app: express.Application = express();
app.use(bodyParser.urlencoded({ extended: false }));

const port: string = process.env.PORT || "8080";
const nodeEnv: string = process.env.NODE_ENV || "development";

const kafkaHost: string = process.env.KAFKA_BOOTSTRAP_SERVER || "0.0.0.0:9094";
//const caCertLocation: string = process.env.CA_CERT_LOCATION || "./ca.crt";
//const kafkaTopic: string = process.env.KAFKA_TOPIC || "test-strimzi-topic";

// const kafkaClientOptions = {
//   kafkaHost: kafkaHost,
//   ssl: true,
//   sslOptions: {
//    key: fileManager.readFile("path/to/key"),
//    cert: fileManager.readFile("path/to/cert"),
//     ca: fileManager.readFile("path/to/ca"),
//     passphrase: "CoFoWh5ayYfQ"
//   }
// };

app.get('/', (req, res, _) => // _ = next
{
  console.log("URL : ", req.url, "\nMETHOD : ", req.method, "\nHEADERS : ", req.headers);
  res.send('<h1>Hello World!</h1>');
});

app.listen(parseInt(port), function () 
{
  console.log(`Server running at http://localhost:${port}/ in ${nodeEnv}`);
  let kafkaClient = new KafkaClient.KafkaClient({ kafkaHost })
  console.log("==================== KAFKA CLIENT ====================");
  console.log(kafkaClient);
  //console.log("==================== TOPIC ====================");
  //console.log(kafkaClient.topicExists. );
  //let consumer = new Consumer(kafkaClient, [{topic: kafkaTopic}], {});
  //console.log("==================== CONSUMER ====================");
  //console.log(consumer);
});