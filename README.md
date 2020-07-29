# Kafka k8s

## Get a K8s cluster
With OVH : https://www.ovh.com/manager/public-cloud/<br/>
In OVH, two (3 for Knative) B2-7-FLEX (2 CPU, 7Go RAM) will do.<br/>
It will take around 15-20 minuts to setup.<br/>
Then, get the kubeconfig and put it on ~/.kube/config

# First solution for Kafka on k8s : 
https://phoenixnap.com/kb/kafka-on-kubernetes










# Second solution for Kafka on k8s : Using Knative

## Install Istio and Knative Serving 0.16
https://knative.dev/docs/install/any-kubernetes-cluster/

Install the Custom Resource Definitions :
```bash
kubectl apply --filename https://github.com/knative/serving/releases/download/v0.16.0/serving-crds.yaml
```
Install the core components of Serving :
```bash
kubectl apply --filename https://github.com/knative/serving/releases/download/v0.16.0/serving-core.yaml
```
Install istioctl on your laptop terminal
```bash
curl -L https://istio.io/downloadIstio | sh -
cd istio-1.6.5
export PATH=$PWD/bin:$PATH
```

Install Istio 1.6.5 for Knative with sidecar injection
```bash
cat << EOF > ./istio-minimal-operator.yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
spec:
  values:
    global:
      proxy:
        autoInject: enabled
      useMCP: false
      # The third-party-jwt is not enabled on all k8s.
      # See: https://istio.io/docs/ops/best-practices/security/#configure-third-party-service-account-tokens
      jwtPolicy: first-party-jwt

  addonComponents:
    pilot:
      enabled: true
    prometheus:
      enabled: false

  components:
    ingressGateways:
      - name: istio-ingressgateway
        enabled: true
      - name: cluster-local-gateway
        enabled: true
        label:
          istio: cluster-local-gateway
          app: cluster-local-gateway
        k8s:
          service:
            type: ClusterIP
            ports:
            - port: 15020
              name: status-port
            - port: 80
              name: http2
            - port: 443
              name: https
EOF
```
```bash
istioctl manifest apply -f istio-minimal-operator.yaml
rm -rf istio-minimal-operator.yaml
```
```bash
kubectl label namespace knative-serving istio-injection=enabled
```
```bash
cat <<EOF | kubectl apply -f -
apiVersion: "security.istio.io/v1beta1"
kind: "PeerAuthentication"
metadata:
  name: "default"
  namespace: "knative-serving"
spec:
  mtls:
    mode: PERMISSIVE
EOF
```
Knative Istio controller
```bash
kubectl apply --filename https://github.com/knative/net-istio/releases/download/v0.16.0/release.yaml
```
## Install Knative Eventing [Second branch]
https://knative.dev/docs/install/any-kubernetes-cluster/#installing-the-eventing-component
```bash
kubectl apply --filename https://github.com/knative/eventing/releases/download/v0.16.0/eventing-crds.yaml
```
```bash
kubectl apply --filename https://github.com/knative/eventing/releases/download/v0.16.0/eventing-core.yaml
```

[Not sure ] Add kafkachannels to ClusterRole knative-eventing-controller in eventing-core.yaml
```bash
[Not sure ]- # Kafka
[Not sure ]  apiGroups:
[Not sure ]  - "kafkachannels.messaging.knative.dev"
[Not sure ]  resources:
[Not sure ]  - "kafkachannels"
[Not sure ]  verbs: *everything
```
```bash
[Not sure ] kubectl apply -f eventing-core.yaml
```
Install a default Channel (messaging) layer (alphabetical) > Apache Kafka
```bash
kubectl create namespace kafka
```

```bash
curl -L "https://github.com/strimzi/strimzi-kafka-operator/releases/download/0.16.2/strimzi-cluster-operator-0.16.2.yaml" \
  | sed 's/namespace: .*/namespace: kafka/' \
  | kubectl -n kafka apply -f -
```

```yaml
cat <<EOF | kubectl apply -f -
apiVersion: kafka.strimzi.io/v1beta1
kind: Kafka
metadata:
  name: my-cluster
  namespace: kafka
spec:
  kafka:
    version: 2.4.0
    replicas: 1
    listeners:
      plain: {}
      tls: {}
    config:
      offsets.topic.replication.factor: 1
      transaction.state.log.replication.factor: 1
      transaction.state.log.min.isr: 1
      log.message.format.version: "2.4"
    storage:
      type: ephemeral
  zookeeper:
    replicas: 3
    storage:
      type: ephemeral
  entityOperator:
    topicOperator: {}
    userOperator: {}
EOF
``` 
```bash
kubectl get pods -n kafka


NAME                                          READY   STATUS    RESTARTS   AGE
my-cluster-entity-operator-65995cf856-ld2zp   3/3     Running   0          102s
my-cluster-kafka-0                            2/2     Running   0          2m8s
my-cluster-zookeeper-0                        2/2     Running   0          2m39s
my-cluster-zookeeper-1                        2/2     Running   0          2m49s
my-cluster-zookeeper-2                        2/2     Running   0          2m59s
strimzi-cluster-operator-77555d4b69-sbrt4     1/1     Running   0          3m14s
```

```bash
kubectl apply --filename https://github.com/knative/eventing/releases/download/v0.16.0/mt-channel-broker.yaml
```

```yaml
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: config-br-defaults
  namespace: knative-eventing
data:
  default-br-config: |
    # This is the cluster-wide default broker channel.
    clusterDefault:
      brokerClass: MTChannelBasedBroker
      apiVersion: v1
      kind: ConfigMap
      name: kafka-channel
      namespace: knative-eventing
EOF
```

```bash
cat <<EOF | kubectl apply -f - 
apiVersion: v1
kind: ConfigMap
metadata:
  name: kafka-channel
  namespace: knative-eventing
data:
  channelTemplateSpec: |
    apiVersion: messaging.knative.dev/v1alpha1
    kind: KafkaChannel
    spec:
      numPartitions: 3
      replicationFactor: 1
EOF
```

```bash
kubectl get pods --namespace knative-eventing


NAME                                   READY   STATUS    RESTARTS   AGE
eventing-controller-75b7567ddc-km6w8   1/1     Running   0          49m
eventing-webhook-5b859fd7f-ggcz8       1/1     Running   2          49m
mt-broker-controller-d5f96b5b5-j65gq   1/1     Running   0          9m11s
mt-broker-filter-5d994fb97f-46qf8      1/1     Running   0          9m12s
mt-broker-ingress-769b458fd-nkjzt      1/1     Running   0          9m11s
```

Apache Kafka Source
```bash
kubectl apply --filename https://github.com/knative/eventing-contrib/releases/download/v0.16.0/kafka-source.yaml
```

## Guide to Apache Kafka on Knative eventing
https://knative.dev/docs/eventing/samples/kafka/binding/

```bash
kubectl apply -f https://storage.googleapis.com/knative-releases/eventing-contrib/latest/kafka-source.yaml
```
```bash
kubectl get pods --namespace knative-sources

NAME                         READY     STATUS    RESTARTS   AGE
kafka-controller-manager-0   1/1       Running   0          42m
```
```yaml
cat <<EOF | kubectl apply -f -
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: event-display
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1" # No scale to zero
    spec:
      containers:
        - image: gcr.io/knative-releases/knative.dev/eventing-contrib/cmd/event_display 
EOF
```

```yaml
cat <<EOF | kubectl apply -f - 
apiVersion: sources.knative.dev/v1beta1
kind: KafkaSource
metadata:
  name: kafka-source
spec:
  consumerGroup: knative-group
  bootstrapServers:
    - my-cluster-kafka-bootstrap.kafka:9092 #note the kafka namespace
  topics:
    - logs
  sink:
    ref:
      apiVersion: serving.knative.dev/v1
      kind: Service
      name: event-display
EOF
```

```yaml
cat <<EOF | kubectl apply -f - 
apiVersion: bindings.knative.dev/v1beta1
kind: KafkaBinding
metadata:
  name: kafka-binding-test
spec:
  subject:
    apiVersion: batch/v1
    kind: Job
    selector:
      matchLabels:
        kafka.topic: "logs"
  bootstrapServers:
    - my-cluster-kafka-bootstrap.kafka:9092
EOF
```
```yaml
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  labels:
    kafka.topic: "logs"
  name: kafka-publisher-job
  namespace: default
spec:
  backoffLimit: 1
  completions: 1
  parallelism: 1
  template:
    metadata:
      annotations:
        sidecar.istio.io/inject: "false"
    spec:
      restartPolicy: Never
      containers:
        - image: docker.io/murugappans/kafka-publisher-1974f83e2ff7c8994707b5e8731528e8@sha256:fd79490514053c643617dc72a43097251fed139c966fd5d131134a0e424882de
          env:
            - name: KAFKA_TOPIC
              value: "logs"
            - name: KAFKA_KEY
              value: "0"
            - name: KAFKA_HEADERS
              value: "content-type:application/json"
            - name: KAFKA_VALUE
              value: '{"msg":"This is a test!"}'
          name: kafka-publisher
EOF
```
```bash
kubectl get pod
kubectl logs event-display-rc8b4-deployment-685f57547c-gqdrn user-container
```


## Guide Knative Eventing [Not Working because we use Apache Kafka]
https://knative.dev/docs/eventing/getting-started/
1. Creating and configuring Knative Eventing Resources
2. Sending events with HTTP requests
3. Verifying events were sent correctly

## 1. Creating and configuring Knative Eventing Resources
```bash
kubectl create namespace event-example
```
```bash
cat <<EOF | kubectl apply -f - 
apiVersion: eventing.knative.dev/v1
kind: Broker
metadata:
  name: default
  namespace: event-example
EOF
```
```bash
kubectl --namespace event-example get Broker default
```
```bash
```
```bash
```
```bash
```