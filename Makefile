.DEFAULT_GOAL := deploy

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
	--stack-name followme-deviceinfo \
	--capabilities CAPABILITY_NAMED_IAM \
	--region $(deploy_region)
