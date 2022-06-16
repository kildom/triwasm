
CPP=g++
TARGET = unitTests.exe
OUTDIR = build
CXXFLAGS = -Wall -O0 -g -DDEBUG=1 -pthread -std=c++14 -Wno-unused-variable
CXXFLAGS += -I../gtest/googletest
CXXFLAGS += -I../gtest/googletest/include
CXXFLAGS += -I../gtest/googlemock
CXXFLAGS += -I../gtest/googlemock/include
CXXFLAGS += -I../../cppUtils

OBJ := $(patsubst ./%.cpp,$(OUTDIR)/obj/%.o,$(wildcard ./*.cpp))
OBJ += $(patsubst ./cppUtils/%.cpp,$(OUTDIR)/obj/cppUtils/%.o,$(wildcard ./cppUtils/*.cpp))

ifneq ($(TEST_FILTER),)
  RUN_FLAGS := --gtest_filter=$(TEST_FILTER)
endif

ifneq ($(TEST_BUILD_ERROR),)
  CXXFLAGS += -D$(TEST_BUILD_ERROR)=1
endif

all: $(OUTDIR)/$(TARGET)

run: $(OUTDIR)/$(TARGET)
	$(OUTDIR)/$(TARGET) $(RUN_FLAGS)

clean:
	rm -Rf $(OUTDIR)

cleanobj:
	rm -Rf $(OUTDIR)/obj

rebuild: clean
	+make all

$(OUTDIR)/obj/marker.txt:
	mkdir -p $(OUTDIR)/obj
	mkdir -p $(OUTDIR)/obj/cppUtils
	echo OK > $(OUTDIR)/obj/marker.txt

$(OUTDIR)/$(TARGET): $(OBJ)
	$(CPP) $(CXXFLAGS) $(OBJ) -o $@

$(OUTDIR)/obj/%.o : ./%.cpp $(OUTDIR)/obj/marker.txt Makefile
	$(CPP) -MD -c $(CXXFLAGS) $(word 1,$<) -o $@

-include $(OUTDIR)/obj/*.d
-include $(OUTDIR)/obj/cppUtils/*.d
