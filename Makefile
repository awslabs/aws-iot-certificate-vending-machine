.DEFAULT_GOAL := deploy

deploy: package-template deploy-template

DEVICE_TABLE_NAME ?= deviceInfo
IOT_DATA_ENDPOINT ?= $(shell aws iot describe-endpoint --endpoint-type iot:Data-ATS --output text)

package-template:
	aws cloudformation package \
	--template-file template.yaml \
	--output-template-file template-output.yaml \
	--s3-bucket $(DEPLOY_BUCKET)

deploy-template:
	aws cloudformation deploy \
	--template-file template-output.yaml \
	--stack-name iot-cvm-stack \
	--capabilities CAPABILITY_NAMED_IAM \
	--parameter-overrides DeviceTableName=$(DEVICE_TABLE_NAME) IotDataEndpoint=$(IOT_DATA_ENDPOINT)
