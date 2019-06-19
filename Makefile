.DEFAULT_GOAL := deploy

deploy_region ?= ap-southeast-2
deploy_bucket ?= aws-iot-cvm-deploy-ap-southeast-2

make-deployment-bucket:
	aws s3 mb s3://$(deploy_bucket) \
	--region $(deploy_region)

deploy: package-template deploy-template

package-template:
	aws cloudformation package \
	--template-file template.yaml \
	--output-template-file template-output.yaml \
	--s3-bucket $(deploy_bucket) \
	--region $(deploy_region)

deploy-template:
	aws cloudformation deploy \
	--template-file template-output.yaml \
	--stack-name iot-cvm-stack \
	--capabilities CAPABILITY_NAMED_IAM \
	--region $(deploy_region)
