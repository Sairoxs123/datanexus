from presidio_analyzer import AnalyzerEngine

analyzer = AnalyzerEngine()

results = analyzer.analyze(text="My Phone number is +97152 441 7540", entities=["PHONE_NUMBER"], language="en")

print(results)
